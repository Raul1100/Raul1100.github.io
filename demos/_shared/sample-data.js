// Shared, realistic sample data for the five apps: one product catalogue, one customer base,
// one team. Everything is fictional (no real company, customer or person), but shaped like a
// wooden-cutlery and paper-straw manufacturer selling to Indian food-service businesses.
(function (g) {
  // SKU, name, category, pack, price per carton (₹), monthly base demand (cartons)
  const SKUS = [
    ['WF-160', '160mm Wooden Fork', 'Cutlery', '1,000 pcs/ctn', 1450, 900],
    ['WS-160', '160mm Wooden Spoon', 'Cutlery', '1,000 pcs/ctn', 1480, 950],
    ['WK-160', '160mm Wooden Knife', 'Cutlery', '1,000 pcs/ctn', 1420, 600],
    ['WP-140', '140mm Wooden Spork', 'Cutlery', '1,000 pcs/ctn', 1380, 250],
    ['IS-095', '95mm Ice Cream Scoop', 'Ice cream', '10,000 pcs/ctn', 980, 700],
    ['TS-065', '65mm Tasting Spoon', 'Ice cream', '10,000 pcs/ctn', 760, 300],
    ['PS-006', '6mm Paper Straw', 'Straws', '5,000 pcs/ctn', 820, 1200],
    ['PS-008', '8mm Paper Straw', 'Straws', '5,000 pcs/ctn', 900, 1000],
    ['BT-012', '12mm Bubble Tea Straw', 'Straws', '2,000 pcs/ctn', 1350, 400],
    ['CS-140', '140mm Coffee Stirrer', 'Stirrers', '5,000 pcs/ctn', 760, 500],
    ['CK-003', 'Cutlery Kit (Fork + Spoon + Napkin)', 'Kits', '500 kits/ctn', 2100, 300],
  ];

  // brand, segment, home city, outlet localities (for chains), typical cartons per order
  const BRANDS = [
    ['Bean Theory Cafés', 'Café chain', 'Mumbai', ['Andheri West', 'Bandra', 'Powai', 'Lower Parel'], 18],
    ['Kulhad Chai Co.', 'Café chain', 'Pune', ['Kothrud', 'Viman Nagar', 'Baner', 'Hinjewadi'], 14],
    ['Daily Grind Coffee', 'Café chain', 'Bengaluru', ['Koramangala', 'Indiranagar', 'HSR Layout', 'Whitefield'], 16],
    ['Bombay Bun Maska', 'QSR', 'Mumbai', ['Dadar', 'Thane', 'Vashi'], 22],
    ['Wrap & Roll', 'QSR', 'Delhi NCR', ['Connaught Place', 'Gurugram Sec 29', 'Noida Sec 18'], 26],
    ['Green Bowl Salads', 'QSR', 'Bengaluru', ['Koramangala', 'Jayanagar'], 12],
    ['Biryani Brothers', 'Cloud kitchen', 'Hyderabad', ['Banjara Hills', 'Gachibowli', 'Kukatpally'], 30],
    ['Tiffin Tales', 'Cloud kitchen', 'Mumbai', ['Malad', 'Chembur'], 24],
    ['Sip & Slurp Bubble Tea', 'Bubble tea', 'Mumbai', ['Andheri West', 'Ghatkopar', 'Vile Parle'], 10],
    ['Boba Bay', 'Bubble tea', 'Bengaluru', ['Indiranagar', 'MG Road'], 9],
    ['Frosted Spoon Gelato', 'Ice cream', 'Mumbai', ['Juhu', 'Colaba', 'Bandra'], 20],
    ['Kulfi Kingdom', 'Ice cream', 'Ahmedabad', ['Navrangpura', 'Satellite', 'Prahlad Nagar'], 28],
    ['Scoop Street Creamery', 'Ice cream', 'Chennai', ['Anna Nagar', 'T Nagar', 'Adyar'], 18],
    ['Juice Junction', 'Juice bar', 'Pune', ['Camp', 'Aundh'], 12],
    ['Saffron Leaf Caterers', 'Catering', 'Mumbai', ['Head office'], 60],
    ['Mehfil Wedding Caterers', 'Catering', 'Jaipur', ['Head office'], 75],
    ['Campus Feast Canteens', 'Institutional', 'Pune', ['Hinjewadi IT Park', 'Magarpatta'], 45],
    ['Corporate Café Services', 'Institutional', 'Bengaluru', ['Electronic City', 'Manyata Tech Park'], 40],
    ['Grand Marigold Hotels', 'Hotels', 'Goa', ['Calangute', 'Panaji'], 35],
    ['Skyline Inflight Catering', 'Inflight', 'Mumbai', ['Airport unit'], 90],
    ['Deccan Disposables', 'Distributor', 'Hyderabad', ['Warehouse'], 120],
    ['Western Hospitality Supplies', 'Distributor', 'Ahmedabad', ['Warehouse'], 140],
    ['Coastal Foodservice Traders', 'Distributor', 'Kochi', ['Warehouse'], 95],
    ['Nordic Café Supply AB', 'Export', 'Stockholm', ['Sweden'], 260],
    ['Harbour Foodservice Ltd', 'Export', 'Bristol', ['United Kingdom'], 320],
    ['Desert Rose Trading LLC', 'Export', 'Dubai', ['UAE'], 280],
  ];

  const TEAM = {
    sales: [['Priya Nair', 'West'], ['Arjun Mehta', 'North'], ['Kavya Rao', 'South'], ['Rohan Desai', 'Key accounts'], ['Sneha Kulkarni', 'Export']],
    operators: ['Ganesh Patil', 'Suresh Yadav', 'Imran Shaikh', 'Mahesh Jadhav', 'Ravi Kumar', 'Anil More', 'Deepak Singh', 'Vijay Pawar', 'Santosh Gaikwad', 'Prakash Naik'],
    supervisors: ['A. Patil', 'S. Khan', 'R. Iyer', 'V. Gupta', 'N. Das'],
  };

  const repFor = b => b[1] === 'Export' ? 'Sneha Kulkarni' : ['Distributor', 'Inflight', 'Hotels'].includes(b[1]) ? 'Rohan Desai'
    : ['Delhi NCR', 'Jaipur'].includes(b[2]) ? 'Arjun Mehta' : ['Bengaluru', 'Hyderabad', 'Chennai', 'Kochi'].includes(b[2]) ? 'Kavya Rao' : 'Priya Nair';

  // Every ordering account = brand outlet (chains order per outlet, like real food-service buyers)
  const ACCOUNTS = [];
  BRANDS.forEach(b => b[3].forEach(loc => ACCOUNTS.push({
    name: b[3].length > 1 ? `${b[0]}, ${loc}` : b[0], brand: b[0], segment: b[1], city: b[2], locality: loc, typical: b[4], rep: repFor(b),
    terms: b[1] === 'Export' ? 'LC 60 days' : b[1] === 'Distributor' ? '45 days' : ['Catering', 'Institutional', 'Hotels', 'Inflight'].includes(b[1]) ? '30 days' : '15 days',
  })));

  g.SAMPLE = { SKUS, BRANDS, ACCOUNTS, TEAM, sku: code => SKUS.find(s => s[0] === code) };
})(typeof window !== 'undefined' ? window : globalThis);
