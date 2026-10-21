package com.fuelfit.service;

import com.fuelfit.dto.ProductInput;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@Service @Profile("!dev")
public class CatalogService {
 private final JdbcTemplate db;
 private final ObjectMapper json = new ObjectMapper();
 public CatalogService(JdbcTemplate db) { this.db=db; }
 private static final String SELECT="SELECT p.*,i.quantity,i.version AS inventory_version FROM products p JOIN inventory i ON i.product_id=p.id";
 public List<Map<String,Object>> categories() { return db.queryForList("SELECT id,name,description FROM categories ORDER BY name"); }
 private Map<String,Object> map(java.sql.ResultSet r,int n) throws java.sql.SQLException {
  var p=new LinkedHashMap<String,Object>();
  for(var k:List.of("id","name","description","image")) p.put(k,r.getString(k));
  p.put("category",r.getString("category_id")); p.put("price",r.getBigDecimal("price"));
  p.put("sizes",json.readValue(r.getString("sizes"),List.class)); p.put("colors",json.readValue(r.getString("colors"),List.class));
  p.put("featured",r.getBoolean("featured")); p.put("active",r.getBoolean("active"));
  p.put("version",r.getLong("version")); p.put("stock",r.getInt("quantity"));
  p.put("inStock",r.getInt("quantity")>0); p.put("inventoryVersion",r.getLong("inventory_version")); return p;
 }
 public Map<String,Object> detail(String id,boolean admin) {
  var rows=db.query(SELECT+" WHERE p.id=?"+(admin?"":" AND p.active=TRUE"),this::map,id);
  if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Product not found");
  return rows.getFirst();
 }
 public Map<String,Object> list(String q,String category,BigDecimal min,BigDecimal max,Boolean inStock,String sort,int page,int size,boolean admin) {
  if(page<0 || page>100000 || size<1 || size>100 || q.length()>200 || category.length()>40 || (min!=null&&min.signum()<0) || (max!=null&&max.signum()<0) || (min!=null&&max!=null&&min.compareTo(max)>0)) throw new IllegalArgumentException();
  var where=new StringBuilder(" WHERE 1=1"); var args=new ArrayList<Object>();
  if(!admin) where.append(" AND p.active=TRUE");
  if(!q.isBlank()) { where.append(" AND (LOWER(p.name) LIKE ? ESCAPE '!' OR LOWER(p.description) LIKE ? ESCAPE '!' OR LOWER(p.category_id) LIKE ? ESCAPE '!')"); String pattern="%"+q.toLowerCase(Locale.ROOT).replace("!","!!").replace("%","!%").replace("_","!_")+"%"; args.add(pattern);args.add(pattern);args.add(pattern); }
  if(!category.isBlank()) {where.append(" AND p.category_id=?");args.add(category);}
  if(min!=null) {where.append(" AND p.price>=?");args.add(min);}
  if(max!=null) {where.append(" AND p.price<=?");args.add(max);}
  if(inStock!=null) where.append(inStock?" AND i.quantity>0":" AND i.quantity=0");
  String order=switch(sort) {case "featured"->"p.featured DESC,p.id"; case "price-low"->"p.price,p.id";case "price-high"->"p.price DESC,p.id";case "name"->"p.name,p.id";default->throw new IllegalArgumentException();};
  Long total=db.queryForObject("SELECT COUNT(*) FROM products p JOIN inventory i ON i.product_id=p.id"+where,Long.class,args.toArray());
  args.add(size);args.add(page*size);
  return Map.of("items",db.query(SELECT+where+" ORDER BY "+order+" LIMIT ? OFFSET ?",this::map,args.toArray()),"total",total,"page",page,"size",size);
 }
 private void category(String id) { if(db.queryForObject("SELECT COUNT(*) FROM categories WHERE id=?",Integer.class,id)==0) throw new IllegalArgumentException("Unknown category"); }
 @Transactional public Map<String,Object> create(ProductInput p) {
  category(p.category()); String id=UUID.randomUUID().toString();
  db.update("INSERT INTO products(id,category_id,name,description,price,image,sizes,colors,featured,active) VALUES (?,?,?,?,?,?,?,?,?,?)",id,p.category(),p.name().trim(),p.description(),p.price(),p.image(),json.writeValueAsString(p.sizes()),json.writeValueAsString(p.colors()),p.featured(),p.active());
  db.update("INSERT INTO inventory(product_id,quantity) VALUES (?,0)",id); return detail(id,true);
 }
 @Transactional public Map<String,Object> update(String id,ProductInput p) {
  detail(id,true);category(p.category());
  int count=db.update("UPDATE products SET category_id=?,name=?,description=?,price=?,image=?,sizes=?,colors=?,featured=?,active=?,version=version+1 WHERE id=? AND version=?",p.category(),p.name().trim(),p.description(),p.price(),p.image(),json.writeValueAsString(p.sizes()),json.writeValueAsString(p.colors()),p.featured(),p.active(),id,p.version());
  if(count!=1) conflict(); return detail(id,true);
 }
 @Transactional public void archive(String id,long version) {
  detail(id,true); if(db.update("UPDATE products SET active=FALSE,version=version+1 WHERE id=? AND version=?",id,version)!=1) conflict();
 }
 @Transactional public Map<String,Object> stock(String id,int quantity,long version) {
  detail(id,true);if(db.update("UPDATE inventory SET quantity=?,version=version+1 WHERE product_id=? AND version=?",quantity,id,version)!=1) conflict();return detail(id,true);
 }
 private void conflict() { throw new ResponseStatusException(HttpStatus.CONFLICT,"Changed by another administrator. Reload before saving."); }
}
