// Bangladesh divisions → districts → upazilas/thanas (English names).
// Names are in English so downstream systems (Steadfast, exports, admin dashboards)
// receive consistent English values.

export interface BDDivision {
  name: string;
  districts: BDDistrict[];
}
export interface BDDistrict {
  name: string;
  upazilas: string[];
}

export const BD_LOCATIONS: BDDivision[] = [
  {
    name: "Dhaka",
    districts: [
      { name: "Dhaka", upazilas: ["Dhamrai","Dohar","Keraniganj","Nawabganj","Savar","Tejgaon","Mohammadpur","Mirpur","Gulshan","Dhanmondi","Uttara","Lalbagh","Sutrapur","Kotwali","Ramna","Paltan","Motijheel","Demra","Cantonment","Shyampur"] },
      { name: "Gazipur", upazilas: ["Gazipur Sadar","Kaliakair","Kapasia","Sreepur","Kaliganj","Tongi"] },
      { name: "Narayanganj", upazilas: ["Narayanganj Sadar","Araihazar","Bandar","Rupganj","Sonargaon"] },
      { name: "Manikganj", upazilas: ["Manikganj Sadar","Singair","Shibalaya","Saturia","Harirampur","Ghior","Daulatpur"] },
      { name: "Munshiganj", upazilas: ["Munshiganj Sadar","Sreenagar","Sirajdikhan","Louhajang","Gazaria","Tongibari"] },
      { name: "Narsingdi", upazilas: ["Narsingdi Sadar","Palash","Shibpur","Monohardi","Belabo","Raipura"] },
      { name: "Tangail", upazilas: ["Tangail Sadar","Kalihati","Ghatail","Madhupur","Bhuapur","Gopalpur","Basail","Sakhipur","Nagarpur","Delduar","Dhanbari","Mirzapur"] },
      { name: "Kishoreganj", upazilas: ["Kishoreganj Sadar","Bhairab","Katiadi","Karimganj","Tarail","Hossainpur","Pakundia","Kuliarchar","Bajitpur","Nikli","Mithamain","Austagram","Itna"] },
      { name: "Faridpur", upazilas: ["Faridpur Sadar","Alfadanga","Boalmari","Charbhadrasan","Madhukhali","Nagarkanda","Sadarpur","Saltha","Bhanga"] },
      { name: "Gopalganj", upazilas: ["Gopalganj Sadar","Kashiani","Kotalipara","Muksudpur","Tungipara"] },
      { name: "Madaripur", upazilas: ["Madaripur Sadar","Kalkini","Rajoir","Shibchar"] },
      { name: "Shariatpur", upazilas: ["Shariatpur Sadar","Naria","Zajira","Gosairhat","Bhedarganj","Damudya"] },
      { name: "Rajbari", upazilas: ["Rajbari Sadar","Goalanda","Pangsha","Baliakandi","Kalukhali"] },
    ],
  },
  {
    name: "Chattogram",
    districts: [
      { name: "Chattogram", upazilas: ["Chattogram Sadar","Anwara","Banshkhali","Boalkhali","Chandanaish","Fatikchhari","Hathazari","Lohagara","Mirsharai","Patiya","Rangunia","Raozan","Sandwip","Satkania","Sitakunda","Karnaphuli"] },
      { name: "Cox's Bazar", upazilas: ["Cox's Bazar Sadar","Chakaria","Kutubdia","Maheshkhali","Pekua","Ramu","Teknaf","Ukhia","Eidgaon"] },
      { name: "Cumilla", upazilas: ["Cumilla Sadar","Daudkandi","Homna","Laksam","Chandina","Barura","Brahmanpara","Chauddagram","Debidwar","Meghna","Muradnagar","Nangalkot","Titas","Monoharganj","Sadar Dakshin","Lalmai"] },
      { name: "Brahmanbaria", upazilas: ["Brahmanbaria Sadar","Ashuganj","Akhaura","Bancharampur","Bijoynagar","Kasba","Nabinagar","Nasirnagar","Sarail"] },
      { name: "Chandpur", upazilas: ["Chandpur Sadar","Haimchar","Kachua","Shahrasti","Hajiganj","Matlab Uttar","Matlab Dakshin","Faridganj"] },
      { name: "Lakshmipur", upazilas: ["Lakshmipur Sadar","Ramganj","Ramgati","Raipur","Kamalnagar"] },
      { name: "Noakhali", upazilas: ["Noakhali Sadar","Kabirhat","Companiganj","Begumganj","Hatiya","Senbagh","Sonaimuri","Subarnachar","Chatkhil"] },
      { name: "Feni", upazilas: ["Feni Sadar","Chhagalnaiya","Fulgazi","Parshuram","Daganbhuiyan","Sonagazi"] },
      { name: "Khagrachhari", upazilas: ["Khagrachhari Sadar","Dighinala","Panchhari","Lakshmichhari","Mahalchhari","Manikchhari","Matiranga","Ramgarh","Guimara"] },
      { name: "Rangamati", upazilas: ["Rangamati Sadar","Baghaichhari","Barkal","Kaukhali","Kaptai","Juraichhari","Langadu","Naniarchar","Rajasthali","Bilaichhari"] },
      { name: "Bandarban", upazilas: ["Bandarban Sadar","Alikadam","Lama","Naikhongchhari","Rowangchhari","Ruma","Thanchi"] },
    ],
  },
  {
    name: "Rajshahi",
    districts: [
      { name: "Rajshahi", upazilas: ["Rajshahi Sadar","Paba","Mohanpur","Charghat","Puthia","Bagha","Godagari","Tanore","Bagmara","Durgapur"] },
      { name: "Natore", upazilas: ["Natore Sadar","Singra","Baraigram","Bagatipara","Lalpur","Gurudaspur","Naldanga"] },
      { name: "Naogaon", upazilas: ["Naogaon Sadar","Mahadevpur","Badalgachhi","Patnitala","Dhamoirhat","Niamatpur","Manda","Atrai","Raninagar","Sapahar","Porsha"] },
      { name: "Pabna", upazilas: ["Pabna Sadar","Atghoria","Ishwardi","Chatmohar","Bhangura","Faridpur","Bera","Santhia","Sujanagar"] },
      { name: "Sirajganj", upazilas: ["Sirajganj Sadar","Belkuchi","Chauhali","Kamarkhanda","Kazipur","Raiganj","Shahjadpur","Tarash","Ullapara"] },
      { name: "Bogura", upazilas: ["Bogura Sadar","Adamdighi","Dhunat","Dupchanchia","Gabtali","Kahaloo","Nandigram","Sariakandi","Shajahanpur","Sherpur","Shibganj","Sonatala"] },
      { name: "Joypurhat", upazilas: ["Joypurhat Sadar","Akkelpur","Kalai","Khetlal","Panchbibi"] },
      { name: "Chapainawabganj", upazilas: ["Chapainawabganj Sadar","Gomastapur","Nachole","Bholahat","Shibganj"] },
    ],
  },
  {
    name: "Khulna",
    districts: [
      { name: "Khulna", upazilas: ["Khulna Sadar","Batiaghata","Dacope","Dighalia","Dumuria","Koyra","Paikgachha","Phultala","Rupsha","Terokhada"] },
      { name: "Jashore", upazilas: ["Jashore Sadar","Abhaynagar","Bagherpara","Chaugachha","Jhikargachha","Keshabpur","Manirampur","Sharsha"] },
      { name: "Satkhira", upazilas: ["Satkhira Sadar","Assasuni","Debhata","Kaliganj","Kalaroa","Shyamnagar","Tala"] },
      { name: "Bagerhat", upazilas: ["Bagerhat Sadar","Chitalmari","Fakirhat","Kachua","Mollahat","Mongla","Morrelganj","Rampal","Sarankhola"] },
      { name: "Kushtia", upazilas: ["Kushtia Sadar","Bheramara","Daulatpur","Khoksa","Kumarkhali","Mirpur"] },
      { name: "Meherpur", upazilas: ["Meherpur Sadar","Gangni","Mujibnagar"] },
      { name: "Chuadanga", upazilas: ["Chuadanga Sadar","Alamdanga","Damurhuda","Jibannagar"] },
      { name: "Jhenaidah", upazilas: ["Jhenaidah Sadar","Harinakunda","Kaliganj","Kotchandpur","Maheshpur","Shailkupa"] },
      { name: "Magura", upazilas: ["Magura Sadar","Mohammadpur","Shalikha","Sreepur"] },
      { name: "Narail", upazilas: ["Narail Sadar","Kalia","Lohagara"] },
    ],
  },
  {
    name: "Barishal",
    districts: [
      { name: "Barishal", upazilas: ["Barishal Sadar","Agailjhara","Babuganj","Bakerganj","Banaripara","Gournadi","Hizla","Mehendiganj","Muladi","Wazirpur"] },
      { name: "Bhola", upazilas: ["Bhola Sadar","Borhanuddin","Char Fasson","Daulatkhan","Lalmohan","Manpura","Tazumuddin"] },
      { name: "Jhalokati", upazilas: ["Jhalokati Sadar","Kathalia","Nalchity","Rajapur"] },
      { name: "Patuakhali", upazilas: ["Patuakhali Sadar","Bauphal","Dashmina","Dumki","Galachipa","Kalapara","Mirzaganj","Rangabali"] },
      { name: "Pirojpur", upazilas: ["Pirojpur Sadar","Bhandaria","Kawkhali","Mathbaria","Nazirpur","Nesarabad","Zianagar"] },
      { name: "Barguna", upazilas: ["Barguna Sadar","Amtali","Betagi","Bamna","Patharghata","Taltali"] },
    ],
  },
  {
    name: "Sylhet",
    districts: [
      { name: "Sylhet", upazilas: ["Sylhet Sadar","Balaganj","Beanibazar","Bishwanath","Companiganj","Fenchuganj","Golapganj","Gowainghat","Jaintiapur","Kanaighat","Zakiganj","Dakshin Surma","Osmani Nagar"] },
      { name: "Moulvibazar", upazilas: ["Moulvibazar Sadar","Barlekha","Juri","Kamalganj","Kulaura","Rajnagar","Sreemangal"] },
      { name: "Habiganj", upazilas: ["Habiganj Sadar","Ajmiriganj","Bahubal","Baniachang","Chunarughat","Lakhai","Madhabpur","Nabiganj","Shayestaganj"] },
      { name: "Sunamganj", upazilas: ["Sunamganj Sadar","Bishwamvarpur","Chhatak","Dakshin Sunamganj","Dharmapasha","Doarabazar","Jagannathpur","Jamalganj","Shalla","Tahirpur","Dirai","Madhyanagar"] },
    ],
  },
  {
    name: "Rangpur",
    districts: [
      { name: "Rangpur", upazilas: ["Rangpur Sadar","Badarganj","Gangachara","Kaunia","Mithapukur","Pirgachha","Pirganj","Taraganj"] },
      { name: "Dinajpur", upazilas: ["Dinajpur Sadar","Birganj","Biral","Birampur","Bochaganj","Chirirbandar","Fulbari","Ghoraghat","Hakimpur","Kaharole","Khansama","Nawabganj","Parbatipur"] },
      { name: "Kurigram", upazilas: ["Kurigram Sadar","Nageshwari","Bhurungamari","Fulbari","Rajarhat","Ulipur","Chilmari","Rowmari","Char Rajibpur"] },
      { name: "Gaibandha", upazilas: ["Gaibandha Sadar","Fulchhari","Saghata","Sadullapur","Palashbari","Gobindaganj","Sundarganj"] },
      { name: "Lalmonirhat", upazilas: ["Lalmonirhat Sadar","Aditmari","Kaliganj","Hatibandha","Patgram"] },
      { name: "Nilphamari", upazilas: ["Nilphamari Sadar","Domar","Dimla","Jaldhaka","Kishoreganj","Saidpur"] },
      { name: "Panchagarh", upazilas: ["Panchagarh Sadar","Atwari","Boda","Debiganj","Tetulia"] },
      { name: "Thakurgaon", upazilas: ["Thakurgaon Sadar","Baliadangi","Haripur","Pirganj","Ranisankail"] },
    ],
  },
  {
    name: "Mymensingh",
    districts: [
      { name: "Mymensingh", upazilas: ["Mymensingh Sadar","Trishal","Bhaluka","Muktagachha","Gouripur","Ishwarganj","Nandail","Gafargaon","Fulbaria","Fulpur","Haluaghat","Dhobaura","Tarakanda"] },
      { name: "Jamalpur", upazilas: ["Jamalpur Sadar","Bakshiganj","Dewanganj","Islampur","Madarganj","Melandaha","Sarishabari"] },
      { name: "Netrokona", upazilas: ["Netrokona Sadar","Atpara","Barhatta","Durgapur","Kalmakanda","Kendua","Khaliajuri","Madan","Mohanganj","Purbadhala"] },
      { name: "Sherpur", upazilas: ["Sherpur Sadar","Nalitabari","Sreebardi","Nakla","Jhenaigati"] },
    ],
  },
];

// Convert Bangla digits to English & strip non-digits.
export function normalizeBanglaPhone(raw: string): string {
  const map: Record<string, string> = {
    "০": "0","১": "1","২": "2","৩": "3","৪": "4","৫": "5","৬": "6","৭": "7","৮": "8","৯": "9",
  };
  let out = "";
  for (const ch of raw) out += map[ch] ?? ch;
  return out.replace(/\D+/g, "");
}
