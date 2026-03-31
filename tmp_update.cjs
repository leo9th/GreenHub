const fs = require('fs');
const path = require('path');

const files = [
  "src/app/pages/Products.tsx",
  "src/app/pages/ProductDetail.tsx",
  "src/app/pages/Cart.tsx",
  "src/app/pages/Checkout.tsx",
  "src/app/pages/Orders.tsx",
  "src/app/pages/OrderDetail.tsx",
  "src/app/pages/seller/Products.tsx",
  "src/app/pages/seller/Dashboard.tsx",
  "src/app/pages/seller/BankDetails.tsx",
  "src/app/pages/seller/AddProduct.tsx",
  "src/app/pages/admin/Products.tsx",
  "src/app/pages/admin/Dashboard.tsx",
  "src/app/pages/auth/Register.tsx"
];

const basePath = "c:/Users/HP/Downloads/Design GreenHub Marketplace (1)";

files.forEach(file => {
  const fullPath = path.join(basePath, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Replace imports
    if (content.includes('from "../data/nigeriaData"')) {
        content = content.replace(/import \{([^}]+)\} from "\.\.\/data\/nigeriaData";/g, 'import { $1 } from "../data/mockData";\nimport { useCurrency } from "../hooks/useCurrency";');
    } else if (content.includes('from "../../data/nigeriaData"')) {
        content = content.replace(/import \{([^}]+)\} from "\.\.\/\.\.\/data\/nigeriaData";/g, 'import { $1 } from "../../data/mockData";\nimport { useCurrency } from "../../hooks/useCurrency";');
    }
    
    // Remove formatNaira from destructured import string if it's there
    content = content.replace(/formatNaira,?\s*/g, '');
    
    // Inject hook
    content = content.replace(/(export default function \w+\([^)]*\)\s*\{)/g, "$1\n  const formatPrice = useCurrency();");
    
    // Replace all usages
    content = content.replace(/formatNaira/g, "formatPrice");

    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${file}`);
  }
});
