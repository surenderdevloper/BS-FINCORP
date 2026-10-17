/**
 * Indian states / union territories with a curated list of major cities and
 * towns, used by the address dropdowns in the customer forms. Kept as a plain
 * local dataset so the app stays dependency-free. Every state also allows a
 * free-text "Other" city for villages / unlisted towns.
 */

export const INDIA_STATES: string[] = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

export const STATE_CITIES: Record<string, string[]> = {
  "Andhra Pradesh": [
    "Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Tirupati",
    "Rajahmundry", "Kakinada", "Anantapur", "Kadapa", "Chittoor", "Eluru",
    "Ongole", "Srikakulam", "Vizianagaram", "Machilipatnam", "Nandyal",
    "Adoni", "Proddatur", "Tenali",
  ],
  "Arunachal Pradesh": [
    "Itanagar", "Naharlagun", "Pasighat", "Tawang", "Ziro", "Bomdila", "Aalo",
    "Tezu", "Roing", "Khonsa",
  ],
  Assam: [
    "Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tinsukia",
    "Tezpur", "Bongaigaon", "Karimganj", "Sivasagar", "Goalpara", "Diphu",
    "Dhubri", "North Lakhimpur", "Barpeta", "Kokrajhar", "Haflong", "Hailakandi",
  ],
  Bihar: [
    "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga", "Purnia",
    "Arrah", "Begusarai", "Katihar", "Munger", "Chhapra", "Danapur", "Saharsa",
    "Hajipur", "Sasaram", "Dehri", "Siwan", "Motihari", "Nawada", "Jamui",
  ],
  Chhattisgarh: [
    "Raipur", "Bhilai", "Bilaspur", "Korba", "Durg", "Rajnandgaon",
    "Jagdalpur", "Raigarh", "Ambikapur", "Dhamtari", "Mahasamund", "Kanker",
    "Chirmiri", "Bhatapara",
  ],
  Goa: [
    "Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda", "Bicholim",
    "Curchorem", "Canacona", "Pernem", "Valpoi",
  ],
  Gujarat: [
    "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar",
    "Junagadh", "Gandhinagar", "Gandhidham", "Anand", "Nadiad", "Morbi",
    "Mehsana", "Bharuch", "Vapi", "Navsari", "Surendranagar", "Bhuj",
    "Porbandar", "Palanpur", "Valsad", "Godhra", "Patan", "Dahod", "Botad",
  ],
  Haryana: [
    "Faridabad", "Gurugram", "Panipat", "Ambala", "Yamunanagar", "Rohtak",
    "Hisar", "Karnal", "Sonipat", "Panchkula", "Bhiwani", "Sirsa",
    "Bahadurgarh", "Jind", "Kaithal", "Rewari", "Palwal", "Kurukshetra",
    "Fatehabad", "Narnaul",
  ],
  "Himachal Pradesh": [
    "Shimla", "Manali", "Dharamshala", "Solan", "Mandi", "Baddi", "Una",
    "Palampur", "Kangra", "Kullu", "Bilaspur", "Hamirpur", "Chamba", "Nahan",
    "Paonta Sahib",
  ],
  Jharkhand: [
    "Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar", "Hazaribagh",
    "Giridih", "Ramgarh", "Medininagar", "Chaibasa", "Dumka", "Phusro",
    "Chirkunda", "Sahibganj",
  ],
  Karnataka: [
    "Bengaluru", "Mysuru", "Hubballi", "Dharwad", "Mangaluru", "Belagavi",
    "Kalaburagi", "Ballari", "Davanagere", "Shivamogga", "Tumakuru",
    "Vijayapura", "Udupi", "Bidar", "Raichur", "Hassan", "Mandya",
    "Chikkamagaluru", "Gadag", "Kolar",
  ],
  Kerala: [
    "Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam",
    "Alappuzha", "Palakkad", "Kannur", "Kottayam", "Malappuram", "Ernakulam",
    "Kasaragod", "Pathanamthitta", "Idukki", "Wayanad",
  ],
  "Madhya Pradesh": [
    "Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Satna",
    "Rewa", "Ratlam", "Dewas", "Singrauli", "Katni", "Burhanpur", "Khandwa",
    "Chhindwara", "Bhind", "Shivpuri", "Vidisha", "Hoshangabad", "Morena",
  ],
  Maharashtra: [
    "Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad", "Solapur",
    "Navi Mumbai", "Kolhapur", "Amravati", "Nanded", "Sangli", "Jalgaon",
    "Akola", "Latur", "Dhule", "Ahmednagar", "Chandrapur", "Parbhani",
    "Kalyan", "Vasai-Virar", "Bhiwandi", "Panvel", "Satara", "Beed",
  ],
  Manipur: [
    "Imphal", "Thoubal", "Bishnupur", "Churachandpur", "Ukhrul", "Senapati",
    "Chandel", "Tamenglong",
  ],
  Meghalaya: [
    "Shillong", "Tura", "Nongstoin", "Jowai", "Baghmara", "Williamnagar",
    "Resubelpara",
  ],
  Mizoram: ["Aizawl", "Lunglei", "Champhai", "Serchhip", "Kolasib", "Saiha", "Mamit"],
  Nagaland: [
    "Kohima", "Dimapur", "Mokokchung", "Tuensang", "Wokha", "Zunheboto",
    "Mon", "Phek",
  ],
  Odisha: [
    "Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri",
    "Balasore", "Bhadrak", "Baripada", "Jharsuguda", "Angul", "Sundargarh",
    "Koraput", "Rayagada",
  ],
  Punjab: [
    "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali",
    "Hoshiarpur", "Pathankot", "Moga", "Batala", "Firozpur", "Phagwara",
    "Sangrur", "Barnala", "Rajpura", "Kapurthala",
  ],
  Rajasthan: [
    "Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer", "Udaipur", "Bhilwara",
    "Alwar", "Bharatpur", "Sikar", "Pali", "Sri Ganganagar", "Tonk",
    "Kishangarh", "Beawar", "Hanumangarh", "Churu", "Jhunjhunu", "Baran",
    "Banswara",
  ],
  Sikkim: ["Gangtok", "Namchi", "Gyalshing", "Mangan", "Rangpo", "Singtam", "Jorethang"],
  "Tamil Nadu": [
    "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem",
    "Tirunelveli", "Tiruppur", "Erode", "Vellore", "Thoothukudi", "Dindigul",
    "Thanjavur", "Nagercoil", "Kanchipuram", "Karur", "Cuddalore",
    "Kumbakonam", "Hosur", "Neyveli", "Rajapalayam",
  ],
  Telangana: [
    "Hyderabad", "Warangal", "Nizamabad", "Khammam", "Karimnagar",
    "Ramagundam", "Mahbubnagar", "Nalgonda", "Adilabad", "Suryapet",
    "Siddipet", "Miryalaguda", "Jagtial", "Mancherial",
  ],
  Tripura: [
    "Agartala", "Udaipur", "Dharmanagar", "Kailashahar", "Belonia", "Khowai",
    "Ambassa",
  ],
  "Uttar Pradesh": [
    "Lucknow", "Kanpur", "Ghaziabad", "Agra", "Varanasi", "Meerut",
    "Prayagraj", "Bareilly", "Aligarh", "Moradabad", "Noida", "Saharanpur",
    "Gorakhpur", "Firozabad", "Jhansi", "Muzaffarnagar", "Mathura", "Rampur",
    "Shahjahanpur", "Farrukhabad", "Ayodhya", "Budaun", "Etawah", "Mirzapur",
    "Bulandshahr",
  ],
  Uttarakhand: [
    "Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rudrapur", "Kashipur",
    "Rishikesh", "Nainital", "Almora", "Pithoragarh", "Kotdwar", "Ramnagar",
  ],
  "West Bengal": [
    "Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri", "Bardhaman",
    "Malda", "Barasat", "Kharagpur", "Haldia", "Krishnanagar", "Jalpaiguri",
    "Kalyani", "Balurghat", "Basirhat", "Cooch Behar",
  ],
  "Andaman and Nicobar Islands": [
    "Port Blair", "Diglipur", "Mayabunder", "Rangat", "Car Nicobar", "Hut Bay",
  ],
  Chandigarh: ["Chandigarh"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Silvassa", "Daman", "Diu", "Amli"],
  Delhi: [
    "New Delhi", "Delhi", "Rohini", "Dwarka", "Saket", "Janakpuri",
    "Lajpat Nagar", "Pitampura",
  ],
  "Jammu and Kashmir": [
    "Srinagar", "Jammu", "Anantnag", "Baramulla", "Udhampur", "Kathua",
    "Sopore", "Rajouri", "Poonch", "Kulgam",
  ],
  Ladakh: ["Leh", "Kargil"],
  Lakshadweep: ["Kavaratti", "Agatti", "Minicoy"],
  Puducherry: ["Puducherry", "Karaikal", "Mahe", "Yanam"],
};

/** Major cities / towns for a state. Returns an empty list for unknown states. */
export function citiesForState(state: string): string[] {
  return STATE_CITIES[state] ?? [];
}

/** Groups a raw Aadhaar digit string into the readable 4-4-4 form. */
export function formatAadhaar(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}
