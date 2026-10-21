package com.fuelfit.service;

import com.fuelfit.dto.CommerceInput.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@Service
@Profile("!dev")
@Transactional(isolation=Isolation.READ_COMMITTED)
public class CommerceService {
    private final JdbcTemplate db;
    private final ObjectMapper json = new ObjectMapper();
    private final CatalogService catalog;
    public CommerceService(JdbcTemplate db, CatalogService catalog) { this.db=db; this.catalog=catalog; }

    // All writes to one account's cart/orders serialize here, including retries and guest imports.
    private long account(String email) {
        var ids=db.queryForList("SELECT id FROM users WHERE email=? FOR UPDATE",Long.class,email);
        if(ids.isEmpty()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Sign in again");
        long id=ids.getFirst();
        if(db.queryForObject("SELECT COUNT(*) FROM carts WHERE user_id=?",Integer.class,id)==0)
            db.update("INSERT INTO carts(user_id) VALUES (?)",id);
        return id;
    }
    private void ownerLock(long userId) { db.queryForObject("SELECT id FROM users WHERE id=? FOR UPDATE",Long.class,userId); }
    private long version(long uid) { return db.queryForObject("SELECT version FROM carts WHERE user_id=?",Long.class,uid); }
    private void bump(long uid) { db.update("UPDATE carts SET version=version+1 WHERE user_id=?",uid); }
    private static ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT,message); }
    private static ResponseStatusException missing() { return new ResponseStatusException(HttpStatus.NOT_FOUND,"Resource not found"); }
    private List<Item> items(long uid) {
        return db.query("SELECT product_id,size_option,color_option,quantity FROM cart_items WHERE user_id=? ORDER BY product_id,size_option,color_option",
            (r,n)->new Item(r.getString(1),r.getString(2),r.getString(3),r.getInt(4)),uid);
    }
    private static List<String> key(Item item) { return List.of(item.productId(),item.size(),item.color()); }
    private Map<String,Object> product(String id,boolean lock) {
        if(lock) {
            // Stable order across carts avoids opposing inventory-lock sequences.
            if(db.queryForList("SELECT id FROM products WHERE id=? FOR UPDATE",String.class,id).isEmpty()) throw missing();
            db.queryForObject("SELECT quantity FROM inventory WHERE product_id=? FOR UPDATE",Integer.class,id);
        }
        return catalog.detail(id,true);
    }
    private boolean valid(Item item,Map<String,Object> p) {
        return Boolean.TRUE.equals(p.get("active")) && option(p.get("sizes"),item.size()) && option(p.get("colors"),item.color());
    }
    private boolean option(Object raw,String value) { var opts=(List<?>)raw; return opts.isEmpty()?value.isEmpty():opts.contains(value); }
    private Map<String,Object> summary(long uid,boolean lock) {
        var lines=new ArrayList<Map<String,Object>>();
        var list=items(uid); var totals=new HashMap<String,Integer>();
        list.forEach(i->totals.merge(i.productId(),i.quantity(),Integer::sum));
        BigDecimal subtotal=BigDecimal.ZERO.setScale(2); boolean available=!list.isEmpty();
        for(Item item:list) {
            var p=product(item.productId(),lock);
            boolean ok=valid(item,p) && totals.get(item.productId())<=((Number)p.get("stock")).intValue();
            available &= ok;
            BigDecimal price=(BigDecimal)p.get("price"), line=price.multiply(BigDecimal.valueOf(item.quantity()));
            subtotal=subtotal.add(line);
            var row=new LinkedHashMap<String,Object>();
            row.put("productId",item.productId()); row.put("size",item.size()); row.put("color",item.color()); row.put("quantity",item.quantity());
            row.put("product",p); row.put("unitPrice",price); row.put("lineTotal",line); row.put("available",ok); lines.add(row);
        }
        BigDecimal shipping=list.isEmpty()||subtotal.compareTo(new BigDecimal("6500"))>=0?BigDecimal.ZERO.setScale(2):new BigDecimal("299.00");
        return new LinkedHashMap<>(Map.of("items",lines,"version",version(uid),"subtotal",subtotal,"shipping",shipping,
            "total",subtotal.add(shipping),"currency","INR","available",available));
    }
    public Map<String,Object> cart(String email) { return summary(account(email),false); }
    public Map<String,Object> replaceCart(String email,Cart input) {
        long uid=account(email);
        if(version(uid)!=input.version()) throw conflict("Your cart changed. Reload it before saving.");
        // Existing unavailable lines may be reduced or removed, so a stale cart can be repaired.
        var existing=new HashMap<List<String>,Item>();items(uid).forEach(i->existing.put(key(i),i));
        validateItems(input.items(),existing);
        db.update("DELETE FROM cart_items WHERE user_id=?",uid);
        for(Item item:input.items()) insert(uid,item);
        bump(uid); return summary(uid,false);
    }
    private void validateItems(List<Item> list) {validateItems(list,Map.of());}
    private void validateItems(List<Item> list,Map<List<String>,Item> existing) {
        var seen=new HashSet<List<String>>();var quantities=new HashMap<String,Integer>();
        list.forEach(i->quantities.merge(i.productId(),i.quantity(),Integer::sum));
        for(Item item:list.stream().sorted(Comparator.comparing(Item::productId)).toList()) {
            if(!seen.add(key(item))) throw new IllegalArgumentException("Duplicate cart line");
            var p=product(item.productId(),true);
            Item old=existing.get(key(item));
            if(old!=null&&item.quantity()<=old.quantity())continue;
            if(!valid(item,p)||quantities.get(item.productId())>((Number)p.get("stock")).intValue()) throw conflict("Selected product options or quantity are unavailable");
        }
    }
    private void insert(long uid,Item i) { db.update("INSERT INTO cart_items(id,user_id,product_id,size_option,color_option,quantity) VALUES (?,?,?,?,?,?)",UUID.randomUUID().toString(),uid,i.productId(),i.size(),i.color(),i.quantity()); }
    public Map<String,Object> merge(String email,Merge input) {
        long uid=account(email);
        if(db.queryForObject("SELECT COUNT(*) FROM cart_merges WHERE user_id=? AND merge_key=?",Integer.class,uid,input.mergeKey())>0) return summary(uid,false);
        var merged=new LinkedHashMap<List<String>,Item>();
        items(uid).forEach(i->merged.put(key(i),i));
        for(Item i:input.items()) {
            Item old=merged.get(key(i)); int quantity=i.quantity()+(old==null?0:old.quantity());
            if(quantity>99) throw conflict("Combined quantity exceeds 99. Adjust your guest cart first.");
            merged.put(key(i),new Item(i.productId(),i.size(),i.color(),quantity));
        }
        if(merged.size()>50) throw conflict("Cart can contain at most 50 lines");
        validateItems(new ArrayList<>(merged.values()));
        db.update("DELETE FROM cart_items WHERE user_id=?",uid);
        merged.values().forEach(i->insert(uid,i));
        db.update("INSERT INTO cart_merges(user_id,merge_key) VALUES (?,?)",uid,input.mergeKey());
        bump(uid);return summary(uid,false);
    }
    private Map<String,Object> quote(long uid,Quote input) {
        if(version(uid)!=input.cartVersion()) throw conflict("Your cart changed. Review checkout again.");
        var summary=summary(uid,true);
        if(!Boolean.TRUE.equals(summary.get("available"))) throw conflict("Your cart is empty or contains unavailable items");
        summary.put("quoteToken",hash(quoteContent(summary,input.address())));
        summary.put("paymentMethod","COD"); return summary;
    }
    private String quoteContent(Map<String,Object> summary,Address address) {
        var lines=((List<?>)summary.get("items")).stream().map(raw->{var row=(Map<?,?>)raw;return List.of(row.get("productId"),row.get("size"),row.get("color"),row.get("quantity"),row.get("unitPrice"));}).toList();
        return json.writeValueAsString(List.of(summary.get("version"),lines,summary.get("total"),address));
    }
    private String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch(java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
    public Map<String,Object> quote(String email,Quote input) {return quote(account(email),input);}
    public Map<String,Object> place(String email,Place input) {
        long uid=account(email);
        String requestHash=hash(json.writeValueAsString(List.of(input.cartVersion(),input.address(),input.quoteToken())));
        var prior=db.queryForList("SELECT id,request_hash FROM orders WHERE user_id=? AND idempotency_key=?",uid,input.idempotencyKey());
        if(!prior.isEmpty()) {
            if(!requestHash.equals(prior.getFirst().get("request_hash"))) throw conflict("Order retry key was used for a different request");
            return orderDetail((String)prior.getFirst().get("id"));
        }
        var quote=quote(uid,new Quote(input.cartVersion(),input.address()));
        if(!input.quoteToken().equals(quote.get("quoteToken"))) throw conflict("Prices changed. Review a new checkout quote.");
        String id=UUID.randomUUID().toString();
        db.update("INSERT INTO orders(id,user_id,order_number,status,payment_method,payment_status,currency,subtotal,shipping,total,address_json,idempotency_key,request_hash) VALUES (?,?,?,'PLACED','COD','PENDING','INR',?,?,?,?,?,?)",
            id,uid,"FF-"+id.toUpperCase(Locale.ROOT),quote.get("subtotal"),quote.get("shipping"),quote.get("total"),json.writeValueAsString(input.address()),input.idempotencyKey(),requestHash);
        for(Object raw:(List<?>)quote.get("items")) {
            var line=(Map<?,?>)raw;var p=(Map<?,?>)line.get("product");
            int quantity=((Number)line.get("quantity")).intValue();
            if(db.update("UPDATE inventory SET quantity=quantity-?,version=version+1 WHERE product_id=? AND quantity>=?",quantity,line.get("productId"),quantity)!=1) throw conflict("Stock changed. Review your cart.");
            db.update("INSERT INTO order_items(id,order_id,product_id,name,image,size_option,color_option,unit_price,quantity,line_total) VALUES (?,?,?,?,?,?,?,?,?,?)",
                UUID.randomUUID().toString(),id,line.get("productId"),p.get("name"),p.get("image"),line.get("size"),line.get("color"),line.get("unitPrice"),quantity,line.get("lineTotal"));
        }
        db.update("DELETE FROM cart_items WHERE user_id=?",uid);bump(uid);return orderDetail(id);
    }
    private Map<String,Object> orderDetail(String id) {
        var rows=db.query("SELECT * FROM orders WHERE id=?",(r,n)->{
            var o=new LinkedHashMap<String,Object>();
            for(String name:List.of("id","order_number","status","payment_method","payment_status","currency")) o.put(switch(name){case "order_number"->"orderNumber";case "payment_method"->"paymentMethod";case "payment_status"->"paymentStatus";default->name;},r.getString(name));
            for(String name:List.of("subtotal","shipping","total"))o.put(name,r.getBigDecimal(name));
            o.put("createdAt",r.getTimestamp("created_at").toInstant().toString());o.put("address",json.readValue(r.getString("address_json"),Map.class));return o;
        },id);
        if(rows.isEmpty())throw missing();var result=rows.getFirst();
        result.put("items",db.query("SELECT * FROM order_items WHERE order_id=? ORDER BY product_id,size_option,color_option",(r,n)->Map.of("productId",r.getString("product_id"),"name",r.getString("name"),"image",r.getString("image"),"size",r.getString("size_option"),"color",r.getString("color_option"),"unitPrice",r.getBigDecimal("unit_price"),"quantity",r.getInt("quantity"),"lineTotal",r.getBigDecimal("line_total")),id));return result;
    }
    public Map<String,Object> orders(String email,boolean admin,int page,int size) {
        if(page<0||page>100000||size<1||size>50)throw new IllegalArgumentException();
        String where=admin?"":" WHERE user_id=?";var args=new ArrayList<Object>();if(!admin)args.add(account(email));
        Long total=db.queryForObject("SELECT COUNT(*) FROM orders"+where,Long.class,args.toArray());args.add(size);args.add(page*size);
        var ids=db.queryForList("SELECT id FROM orders"+where+" ORDER BY created_at DESC,id LIMIT ? OFFSET ?",String.class,args.toArray());
        return Map.of("items",ids.stream().map(this::orderDetail).toList(),"total",total,"page",page,"size",size);
    }
    public Map<String,Object> order(String email,String id,boolean admin) {
        if(!admin && db.queryForObject("SELECT COUNT(*) FROM orders WHERE id=? AND user_id=?",Integer.class,id,account(email))==0)throw missing();
        return orderDetail(id);
    }
    public Map<String,Object> status(String email,String id,String next,boolean admin) {
        var owners=db.queryForList("SELECT user_id FROM orders WHERE id=?",Long.class,id);
        if(owners.isEmpty())throw missing();long uid=owners.getFirst();
        if(admin)ownerLock(uid);else if(account(email)!=uid)throw missing();
        String current=db.queryForObject("SELECT status FROM orders WHERE id=? FOR UPDATE",String.class,id);
        if(current.equals(next)) return orderDetail(id);
        boolean cancel=next.equals("CANCELLED")&&(current.equals("PLACED")||current.equals("CONFIRMED"));
        boolean forward=admin&&switch(current){case "PLACED"->next.equals("CONFIRMED");case "CONFIRMED"->next.equals("SHIPPED");case "SHIPPED"->next.equals("DELIVERED");default->false;};
        if(!cancel&&!forward)throw conflict("This order status change is not permitted");
        if(cancel) {
            var lines=db.queryForList("SELECT product_id,quantity FROM order_items WHERE order_id=? ORDER BY product_id",id);
            for(var line:lines) db.update("UPDATE inventory SET quantity=quantity+?,version=version+1 WHERE product_id=?",line.get("quantity"),line.get("product_id"));
        }
        db.update("UPDATE orders SET status=?,payment_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",next,cancel?"CANCELLED":next.equals("DELIVERED")?"COLLECTED":"PENDING",id);
        return orderDetail(id);
    }
    public List<Map<String,Object>> addresses(String email) {
        long uid=account(email);
        return db.query("SELECT * FROM addresses WHERE user_id=? ORDER BY id",(r,n)->Map.of("id",r.getString("id"),"name",r.getString("name"),"phone",r.getString("phone"),"line1",r.getString("line1"),"line2",r.getString("line2"),"city",r.getString("city"),"state",r.getString("state"),"postalCode",r.getString("postal_code"),"country",r.getString("country")),uid);
    }
    public Map<String,String> saveAddress(String email,String id,Address a) {
        long uid=account(email);
        if(id==null) {
            if(db.queryForObject("SELECT COUNT(*) FROM addresses WHERE user_id=?",Integer.class,uid)>=20)throw conflict("At most 20 saved addresses are allowed");
            id=UUID.randomUUID().toString();
            db.update("INSERT INTO addresses(id,user_id,name,phone,line1,line2,city,state,postal_code,country) VALUES (?,?,?,?,?,?,?,?,?,?)",id,uid,a.name(),a.phone(),a.line1(),a.line2(),a.city(),a.state(),a.postalCode(),a.country());
        } else if(db.update("UPDATE addresses SET name=?,phone=?,line1=?,line2=?,city=?,state=?,postal_code=?,country=? WHERE id=? AND user_id=?",a.name(),a.phone(),a.line1(),a.line2(),a.city(),a.state(),a.postalCode(),a.country(),id,uid)!=1)throw missing();
        return Map.of("id",id);
    }
    public void deleteAddress(String email,String id) {if(db.update("DELETE FROM addresses WHERE id=? AND user_id=?",id,account(email))!=1)throw missing();}
    public List<Map<String,Object>> wishlist(String email) {
        return db.queryForList("SELECT product_id FROM wishlist_items WHERE user_id=? ORDER BY product_id",String.class,account(email)).stream().map(id->catalog.detail(id,true)).toList();
    }
    public void wishlist(String email,String productId,boolean add) {
        long uid=account(email);
        if(!add){db.update("DELETE FROM wishlist_items WHERE user_id=? AND product_id=?",uid,productId);return;}
        catalog.detail(productId,false);
        if(db.queryForObject("SELECT COUNT(*) FROM wishlist_items WHERE user_id=? AND product_id=?",Integer.class,uid,productId)==0) {
            if(db.queryForObject("SELECT COUNT(*) FROM wishlist_items WHERE user_id=?",Integer.class,uid)>=200)throw conflict("Wishlist limit reached");
            db.update("INSERT INTO wishlist_items(user_id,product_id) VALUES (?,?)",uid,productId);
        }
    }
    public void newsletter(Newsletter input) {
        String email=input.email().trim().toLowerCase(Locale.ROOT);
        db.update("INSERT INTO newsletter_subscribers(email,subscribed) VALUES (?,TRUE) ON DUPLICATE KEY UPDATE subscribed=TRUE,consent_at=CURRENT_TIMESTAMP",email);
    }
    public void unsubscribe(String email) {db.update("UPDATE newsletter_subscribers SET subscribed=FALSE WHERE email=?",email.toLowerCase(Locale.ROOT));}
    public void category(Category input,boolean create) {
        if(create)db.update("INSERT INTO categories(id,name,description) VALUES (?,?,?)",input.id(),input.name().trim(),input.description());
        else if(db.update("UPDATE categories SET name=?,description=? WHERE id=?",input.name().trim(),input.description(),input.id())!=1)throw missing();
    }
}
