// Browser-only fixture: never used as a fallback by the application.
const original = require('./fixtures/catalog.json');
module.exports = async function mockCatalog(context, options = {}) {
 const products = structuredClone(original).map(p=>({...p, stock:20, inStock:true, active:true, version:0, inventoryVersion:0}));
 await context.route('**/api/categories',route=>route.fulfill({json:[
  {id:'apparel',name:'Apparel',description:'Performance gear engineered to move with you'},
  {id:'supplements',name:'Supplements',description:'Science-backed nutrition to fuel every session'},
  {id:'accessories',name:'Accessories',description:'Essential training tools for every athlete'}]}));
 await context.route('**/api/products**',route=>{
  const url=new URL(route.request().url()), id=url.pathname.split('/')[3];
  if(options.fail) return route.fulfill({status:503,json:{message:'Catalog unavailable'}});
  if(id){const p=products.find(p=>p.id===id&&p.active);return route.fulfill({status:p?200:404,json:p||{message:'Product not found'}});}
  const q=url.searchParams, search=(q.get('q')||'').toLowerCase();
  let items=products.filter(p=>p.active&&(!q.get('category')||p.category===q.get('category'))&&(!search||(p.name+' '+p.description+' '+p.category).toLowerCase().includes(search))&&(!q.get('minPrice')||p.price>=Number(q.get('minPrice')))&&(!q.get('maxPrice')||p.price<=Number(q.get('maxPrice')))&&(!q.get('inStock')||p.inStock===(q.get('inStock')==='true')));
  const sort=q.get('sort');items.sort(sort==='price-low'?(a,b)=>a.price-b.price:sort==='price-high'?(a,b)=>b.price-a.price:sort==='name'?(a,b)=>a.name.localeCompare(b.name):(a,b)=>b.featured-a.featured||a.id.localeCompare(b.id));
  const page=Number(q.get('page')||0),size=Number(q.get('size')||24),total=items.length;
  return route.fulfill({json:{items:items.slice(page*size,(page+1)*size),page,size,total}});
 });
 return products;
};
