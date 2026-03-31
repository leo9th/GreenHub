// Nigerian States and LGAs
export const nigerianStates = [
  { name: "Abia", code: "AB" },
  { name: "Adamawa", code: "AD" },
  { name: "Akwa Ibom", code: "AK" },
  { name: "Anambra", code: "AN" },
  { name: "Bauchi", code: "BA" },
  { name: "Bayelsa", code: "BY" },
  { name: "Benue", code: "BE" },
  { name: "Borno", code: "BO" },
  { name: "Cross River", code: "CR" },
  { name: "Delta", code: "DE" },
  { name: "Ebonyi", code: "EB" },
  { name: "Edo", code: "ED" },
  { name: "Ekiti", code: "EK" },
  { name: "Enugu", code: "EN" },
  { name: "FCT", code: "FC" },
  { name: "Gombe", code: "GO" },
  { name: "Imo", code: "IM" },
  { name: "Jigawa", code: "JI" },
  { name: "Kaduna", code: "KD" },
  { name: "Kano", code: "KN" },
  { name: "Katsina", code: "KT" },
  { name: "Kebbi", code: "KE" },
  { name: "Kogi", code: "KO" },
  { name: "Kwara", code: "KW" },
  { name: "Lagos", code: "LA" },
  { name: "Nasarawa", code: "NA" },
  { name: "Niger", code: "NI" },
  { name: "Ogun", code: "OG" },
  { name: "Ondo", code: "ON" },
  { name: "Osun", code: "OS" },
  { name: "Oyo", code: "OY" },
  { name: "Plateau", code: "PL" },
  { name: "Rivers", code: "RI" },
  { name: "Sokoto", code: "SO" },
  { name: "Taraba", code: "TA" },
  { name: "Yobe", code: "YO" },
  { name: "Zamfara", code: "ZA" },
];

export const lgas: Record<string, string[]> = {
  Lagos: ["Agege", "Ajeromi-Ifelodun", "Alimosho", "Amuwo-Odofin", "Apapa", "Badagry", "Epe", "Eti-Osa", "Ibeju-Lekki", "Ifako-Ijaiye", "Ikeja", "Ikorodu", "Kosofe", "Lagos Island", "Lagos Mainland", "Mushin", "Ojo", "Oshodi-Isolo", "Shomolu", "Surulere"],
  Abuja: ["Abaji", "Abuja Municipal", "Bwari", "Gwagwalada", "Kuje", "Kwali"],
  Kano: ["Ajingi", "Albasu", "Bagwai", "Bebeji", "Bichi", "Bunkure", "Dala", "Dambatta", "Dawakin Kudu", "Dawakin Tofa", "Doguwa", "Fagge", "Gabasawa", "Garko", "Garun Mallam", "Gaya", "Gezawa", "Gwale", "Gwarzo", "Kabo"],
  "Rivers": ["Abua/Odual", "Ahoada East", "Ahoada West", "Akuku-Toru", "Andoni", "Asari-Toru", "Bonny", "Degema", "Eleme", "Emohua", "Etche", "Gokana", "Ikwerre", "Khana", "Obio/Akpor", "Ogba/Egbema/Ndoni", "Ogu/Bolo", "Okrika", "Omuma", "Opobo/Nkoro", "Oyigbo", "Port Harcourt", "Tai"],
  Oyo: ["Afijio", "Akinyele", "Atiba", "Atisbo", "Egbeda", "Ibadan North", "Ibadan North-East", "Ibadan North-West", "Ibadan South-East", "Ibadan South-West", "Ibarapa Central", "Ibarapa East", "Ibarapa North", "Ido", "Irepo", "Iseyin", "Itesiwaju", "Iwajowa", "Kajola", "Lagelu"],
  Kaduna: ["Birnin Gwari", "Chikun", "Giwa", "Igabi", "Ikara", "Jaba", "Jema'a", "Kachia", "Kaduna North", "Kaduna South", "Kagarko", "Kajuru", "Kaura", "Kauru", "Kubau", "Kudan", "Lere", "Makarfi", "Sabon Gari", "Sanga", "Soba", "Zangon Kataf", "Zaria"],
};

export const nigerianBanks = [
  "Access Bank",
  "Citibank Nigeria",
  "Ecobank Nigeria",
  "Fidelity Bank",
  "First Bank of Nigeria",
  "First City Monument Bank (FCMB)",
  "Globus Bank",
  "Guaranty Trust Bank (GTBank)",
  "Heritage Bank",
  "Jaiz Bank",
  "Keystone Bank",
  "Polaris Bank",
  "Providus Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered Bank",
  "Sterling Bank",
  "SunTrust Bank",
  "Titan Trust Bank",
  "Union Bank of Nigeria",
  "United Bank for Africa (UBA)",
  "Unity Bank",
  "Wema Bank",
  "Zenith Bank",
];

export const deliveryServices = [
  { name: "GIGL", logo: "🚚", description: "Fast nationwide delivery" },
  { name: "Sendy", logo: "📦", description: "Same-day delivery in Lagos" },
  { name: "Pickup", logo: "🤝", description: "Meet seller in person" },
];

export const categories = [
  { id: "electronics", name: "Electronics", icon: "📱", emoji: "📱" },
  { id: "fashion", name: "Fashion", icon: "👕", emoji: "👕" },
  { id: "home", name: "Home & Living", icon: "🏠", emoji: "🏠" },
  { id: "vehicles", name: "Vehicles", icon: "🚗", emoji: "🚗" },
  { id: "property", name: "Property", icon: "🏢", emoji: "🏢" },
  { id: "beauty", name: "Beauty", icon: "💄", emoji: "💄" },
  { id: "sports", name: "Sports", icon: "⚽", emoji: "⚽" },
  { id: "other", name: "Other", icon: "📦", emoji: "📦" },
];

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export function getLGAsForState(stateName: string): string[] {
  return lgas[stateName] || [];
}
