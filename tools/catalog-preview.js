// Local visual fixture only; no backend requests or mutations.
import '../src/tokens.css';
import '../src/style.css';
import '../src/management.css';
import '../src/theme.css';
import '../src/readability.css';
import '../src/font.css';
import '../src/catalog-manager.css';
import {menuCatalogHtml,bindCatalog} from '../src/catalog-manager.js';
const categories=['Khai vị','Cơm & mì','Món Việt','Món nướng','Lẩu','Hải sản','Rau & đậu','Tráng miệng','Cà phê & trà','Bia & đồ uống'].map((name,i)=>({id:i+1,name}));
const names=['Bò lúc lắc','Cơm chiên hải sản','Gỏi tôm rau thơm','Gà nướng mật ong','Lẩu Thái hải sản','Đậu hũ chiên','Trà cam','Bia Saigon'];
const products=Array.from({length:112},(_,i)=>({id:i+1,code:`MON-${String(i+1).padStart(3,'0')}`,name:names[i%names.length],categoryId:i%10+1,category:categories[i%10],isActive:i%19!==18,requiresPreparation:i%8<6,canOrder:i%11!==10,_count:{recipes:i%17===16?0:2},maxOrderQuantity:24+i,sellingPrice:59000+(i%6)*20000,imageUrl:i%8===1?'/dishes/seafood-fried-rice.webp':null}));
const data={categories,products,admin:true,chef:true};
document.querySelector('#preview').style.cssText='max-width:1440px;margin:auto;padding:28px 20px;font-family:var(--font-ui)';
document.querySelector('#preview').innerHTML=`<p style="color:var(--muted);font-size:12px">THỰC ĐƠN</p><h1 style="margin:8px 0">Món & nhóm món</h1><p style="color:var(--muted);margin-bottom:28px">Sắp xếp thực đơn, giá bán và công thức chế biến.</p>${menuCatalogHtml(data)}`;
bindCatalog(document.querySelector('#menu-admin'),data);
