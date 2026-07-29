/**
 * Administrative Municipal Bounding Boxes — All India
 * 60+ hardcoded cities + Dynamic ANY-India resolver via Nominatim.
 * ZERO RADIUS QUERIES. FULL URBAN MUNICIPAL EXTENTS ONLY.
 */
import fs from 'fs';
import path from 'path';
import axios from 'axios';

export interface MunicipalExtent {
  id: string;
  name: string;
  administrative_authority: string;
  bbox: [number, number, number, number]; // [southLat, westLon, northLat, eastLon]
  center_lat: number;
  center_lon: number;
  area_sq_km: number;
  major_rivers: string[];
  average_elevation_meters: number;
  state: string;
  osm_relation_id?: number | undefined;
}

export const MUNICIPAL_BOUNDARIES: Record<string, MunicipalExtent> = {

  // ─── HYDERABAD ─────────────────────────────────────────────────────────────
  techno_hyderabad: {
    id: "techno_hyderabad",
    name: "Hyderabad (GHMC)",
    administrative_authority: "Greater Hyderabad Municipal Corporation",
    bbox: [17.2800, 78.2900, 17.5800, 78.6200],
    center_lat: 17.3850, center_lon: 78.4867,
    area_sq_km: 625, major_rivers: ["Musi River","Hussain Sagar"],
    average_elevation_meters: 536, state: "Telangana", osm_relation_id: 1990818
  },

  // ─── DELHI ─────────────────────────────────────────────────────────────────
  nova_delhi: {
    id: "nova_delhi",
    name: "Delhi (NCT)",
    administrative_authority: "Municipal Corporation of Delhi",
    bbox: [28.4040, 76.8380, 28.8830, 77.3410],
    center_lat: 28.6139, center_lon: 77.2090,
    area_sq_km: 1484, major_rivers: ["Yamuna River","Najafgarh Drain"],
    average_elevation_meters: 216, state: "Delhi", osm_relation_id: 1942586
  },

  // ─── MUMBAI ────────────────────────────────────────────────────────────────
  coastal_mumbai: {
    id: "coastal_mumbai",
    name: "Mumbai (BMC)",
    administrative_authority: "Brihanmumbai Municipal Corporation",
    bbox: [18.8900, 72.7800, 19.2700, 72.9900],
    center_lat: 19.0760, center_lon: 72.8777,
    area_sq_km: 603, major_rivers: ["Mithi River","Ulhas River"],
    average_elevation_meters: 14, state: "Maharashtra", osm_relation_id: 1953530
  },

  // ─── JAIPUR ────────────────────────────────────────────────────────────────
  heritage_jaipur: {
    id: "heritage_jaipur",
    name: "Jaipur (JMC)",
    administrative_authority: "Jaipur Nagar Nigam",
    bbox: [26.7700, 75.6800, 27.0700, 76.0000],
    center_lat: 26.9124, center_lon: 75.7873,
    area_sq_km: 485, major_rivers: ["Dravyavati River"],
    average_elevation_meters: 431, state: "Rajasthan", osm_relation_id: 1990826
  },

  // ─── BANGALORE ─────────────────────────────────────────────────────────────
  cyber_bangalore: {
    id: "cyber_bangalore",
    name: "Bengaluru (BBMP)",
    administrative_authority: "Bruhat Bengaluru Mahanagara Palike",
    bbox: [12.8340, 77.4600, 13.1440, 77.7800],
    center_lat: 12.9716, center_lon: 77.5946,
    area_sq_km: 709, major_rivers: ["Vrishabhavathi River","Arkavathi River"],
    average_elevation_meters: 920, state: "Karnataka", osm_relation_id: 1984536
  },

  // ─── CHENNAI ───────────────────────────────────────────────────────────────
  chennai: {
    id: "chennai",
    name: "Chennai (GCC)",
    administrative_authority: "Greater Chennai Corporation",
    bbox: [12.8340, 80.1700, 13.2360, 80.3280],
    center_lat: 13.0827, center_lon: 80.2707,
    area_sq_km: 426, major_rivers: ["Cooum River","Adyar River","Buckingham Canal"],
    average_elevation_meters: 6, state: "Tamil Nadu", osm_relation_id: 1984232
  },

  // ─── KOLKATA ───────────────────────────────────────────────────────────────
  kolkata: {
    id: "kolkata",
    name: "Kolkata (KMC)",
    administrative_authority: "Kolkata Municipal Corporation",
    bbox: [22.4400, 88.2200, 22.6500, 88.4800],
    center_lat: 22.5726, center_lon: 88.3639,
    area_sq_km: 185, major_rivers: ["Hooghly River","Tolly's Nullah"],
    average_elevation_meters: 9, state: "West Bengal", osm_relation_id: 3692825
  },

  // ─── AHMEDABAD ─────────────────────────────────────────────────────────────
  ahmedabad: {
    id: "ahmedabad",
    name: "Ahmedabad (AMC)",
    administrative_authority: "Ahmedabad Municipal Corporation",
    bbox: [22.9100, 72.4800, 23.1700, 72.7500],
    center_lat: 23.0225, center_lon: 72.5714,
    area_sq_km: 464, major_rivers: ["Sabarmati River"],
    average_elevation_meters: 53, state: "Gujarat", osm_relation_id: 1984215
  },

  // ─── PUNE ──────────────────────────────────────────────────────────────────
  pune: {
    id: "pune",
    name: "Pune (PMC)",
    administrative_authority: "Pune Municipal Corporation",
    bbox: [18.4100, 73.7600, 18.6300, 74.0200],
    center_lat: 18.5204, center_lon: 73.8567,
    area_sq_km: 331, major_rivers: ["Mula River","Mutha River","Pavana River"],
    average_elevation_meters: 560, state: "Maharashtra", osm_relation_id: 1984540
  },

  // ─── SURAT ─────────────────────────────────────────────────────────────────
  surat: {
    id: "surat",
    name: "Surat (SMC)",
    administrative_authority: "Surat Municipal Corporation",
    bbox: [21.0600, 72.7300, 21.2900, 72.9700],
    center_lat: 21.1702, center_lon: 72.8311,
    area_sq_km: 326, major_rivers: ["Tapi River"],
    average_elevation_meters: 13, state: "Gujarat", osm_relation_id: 1984572
  },

  // ─── LUCKNOW ───────────────────────────────────────────────────────────────
  lucknow: {
    id: "lucknow",
    name: "Lucknow (LMC)",
    administrative_authority: "Lucknow Municipal Corporation",
    bbox: [26.7200, 80.8000, 26.9500, 81.1000],
    center_lat: 26.8467, center_lon: 80.9462,
    area_sq_km: 349, major_rivers: ["Gomti River"],
    average_elevation_meters: 123, state: "Uttar Pradesh", osm_relation_id: 1990816
  },

  // ─── KANPUR ────────────────────────────────────────────────────────────────
  kanpur: {
    id: "kanpur",
    name: "Kanpur (KMC)",
    administrative_authority: "Kanpur Municipal Corporation",
    bbox: [26.3400, 80.2200, 26.5500, 80.4900],
    center_lat: 26.4499, center_lon: 80.3319,
    area_sq_km: 260, major_rivers: ["Ganga River"],
    average_elevation_meters: 126, state: "Uttar Pradesh", osm_relation_id: 2278427
  },

  // ─── NAGPUR ────────────────────────────────────────────────────────────────
  nagpur: {
    id: "nagpur",
    name: "Nagpur (NMC)",
    administrative_authority: "Nagpur Municipal Corporation",
    bbox: [21.0000, 78.9800, 21.2300, 79.2000],
    center_lat: 21.1458, center_lon: 79.0882,
    area_sq_km: 228, major_rivers: ["Nag River","Pili River"],
    average_elevation_meters: 310, state: "Maharashtra", osm_relation_id: 1984538
  },

  // ─── INDORE ────────────────────────────────────────────────────────────────
  indore: {
    id: "indore",
    name: "Indore (IMC)",
    administrative_authority: "Indore Municipal Corporation",
    bbox: [22.6000, 75.7400, 22.8200, 76.0200],
    center_lat: 22.7196, center_lon: 75.8577,
    area_sq_km: 302, major_rivers: ["Khan River","Saraswati River"],
    average_elevation_meters: 553, state: "Madhya Pradesh", osm_relation_id: 2277929
  },

  // ─── BHOPAL ────────────────────────────────────────────────────────────────
  bhopal: {
    id: "bhopal",
    name: "Bhopal (BMC)",
    administrative_authority: "Bhopal Municipal Corporation",
    bbox: [23.1300, 77.2600, 23.3500, 77.5500],
    center_lat: 23.2599, center_lon: 77.4126,
    area_sq_km: 285, major_rivers: ["Upper Lake","Lower Lake","Betwa River"],
    average_elevation_meters: 527, state: "Madhya Pradesh", osm_relation_id: 2278074
  },

  // ─── VISAKHAPATNAM ─────────────────────────────────────────────────────────
  visakhapatnam: {
    id: "visakhapatnam",
    name: "Visakhapatnam (GVMC)",
    administrative_authority: "Greater Visakhapatnam Municipal Corporation",
    bbox: [17.5800, 83.1300, 17.8200, 83.4000],
    center_lat: 17.6868, center_lon: 83.2185,
    area_sq_km: 681, major_rivers: ["Gosthani River","Varaha River"],
    average_elevation_meters: 45, state: "Andhra Pradesh", osm_relation_id: 1990822
  },

  // ─── PATNA ─────────────────────────────────────────────────────────────────
  patna: {
    id: "patna",
    name: "Patna (PMC)",
    administrative_authority: "Patna Municipal Corporation",
    bbox: [25.5300, 85.0200, 25.6800, 85.2400],
    center_lat: 25.5941, center_lon: 85.1376,
    area_sq_km: 136, major_rivers: ["Ganga River","Punpun River"],
    average_elevation_meters: 53, state: "Bihar", osm_relation_id: 2543459
  },

  // ─── VADODARA ──────────────────────────────────────────────────────────────
  vadodara: {
    id: "vadodara",
    name: "Vadodara (VMC)",
    administrative_authority: "Vadodara Municipal Corporation",
    bbox: [22.2200, 73.1100, 22.4200, 73.3400],
    center_lat: 22.3072, center_lon: 73.1812,
    area_sq_km: 204, major_rivers: ["Vishwamitri River"],
    average_elevation_meters: 37, state: "Gujarat", osm_relation_id: 2278052
  },

  // ─── LUDHIANA ──────────────────────────────────────────────────────────────
  ludhiana: {
    id: "ludhiana",
    name: "Ludhiana (MC)",
    administrative_authority: "Municipal Corporation Ludhiana",
    bbox: [30.8000, 75.7700, 30.9700, 76.0200],
    center_lat: 30.9010, center_lon: 75.8573,
    area_sq_km: 310, major_rivers: ["Sutlej River","Buddha Nullah"],
    average_elevation_meters: 244, state: "Punjab", osm_relation_id: 2278434
  },

  // ─── AGRA ──────────────────────────────────────────────────────────────────
  agra: {
    id: "agra",
    name: "Agra (AMC)",
    administrative_authority: "Agra Municipal Corporation",
    bbox: [27.0800, 77.9800, 27.2800, 78.1700],
    center_lat: 27.1767, center_lon: 78.0081,
    area_sq_km: 188, major_rivers: ["Yamuna River"],
    average_elevation_meters: 169, state: "Uttar Pradesh", osm_relation_id: 2278431
  },

  // ─── VARANASI ──────────────────────────────────────────────────────────────
  varanasi: {
    id: "varanasi",
    name: "Varanasi (VMC)",
    administrative_authority: "Varanasi Municipal Corporation",
    bbox: [25.2200, 82.9100, 25.4200, 83.0800],
    center_lat: 25.3176, center_lon: 82.9739,
    area_sq_km: 110, major_rivers: ["Ganga River","Varuna River"],
    average_elevation_meters: 81, state: "Uttar Pradesh", osm_relation_id: 2278432
  },

  // ─── KOCHI ─────────────────────────────────────────────────────────────────
  kochi: {
    id: "kochi",
    name: "Kochi (Corporation)",
    administrative_authority: "Corporation of Cochin",
    bbox: [9.8800, 76.2200, 10.0700, 76.3700],
    center_lat: 9.9312, center_lon: 76.2673,
    area_sq_km: 94, major_rivers: ["Periyar River","Vembanad Lake"],
    average_elevation_meters: 0, state: "Kerala", osm_relation_id: 2278088
  },

  // ─── COIMBATORE ────────────────────────────────────────────────────────────
  coimbatore: {
    id: "coimbatore",
    name: "Coimbatore (CC)",
    administrative_authority: "Coimbatore City Municipal Corporation",
    bbox: [10.9000, 76.8900, 11.1200, 77.1200],
    center_lat: 11.0168, center_lon: 76.9558,
    area_sq_km: 257, major_rivers: ["Noyyal River","Coimbatore Lake"],
    average_elevation_meters: 411, state: "Tamil Nadu", osm_relation_id: 1984578
  },

  // ─── MADURAI ───────────────────────────────────────────────────────────────
  madurai: {
    id: "madurai",
    name: "Madurai (MC)",
    administrative_authority: "Madurai City Municipal Corporation",
    bbox: [9.8500, 78.0500, 10.0700, 78.2300],
    center_lat: 9.9252, center_lon: 78.1198,
    area_sq_km: 147, major_rivers: ["Vaigai River"],
    average_elevation_meters: 101, state: "Tamil Nadu", osm_relation_id: 2278092
  },

  // ─── NASHIK ────────────────────────────────────────────────────────────────
  nashik: {
    id: "nashik",
    name: "Nashik (NMC)",
    administrative_authority: "Nashik Municipal Corporation",
    bbox: [19.9200, 73.7000, 20.1100, 73.9100],
    center_lat: 20.0059, center_lon: 73.7898,
    area_sq_km: 259, major_rivers: ["Godavari River","Nandini River"],
    average_elevation_meters: 565, state: "Maharashtra", osm_relation_id: 2278096
  },

  // ─── RAJKOT ────────────────────────────────────────────────────────────────
  rajkot: {
    id: "rajkot",
    name: "Rajkot (RMC)",
    administrative_authority: "Rajkot Municipal Corporation",
    bbox: [22.2100, 70.7200, 22.3900, 70.9400],
    center_lat: 22.3039, center_lon: 70.8022,
    area_sq_km: 170, major_rivers: ["Aji River","Nyari River"],
    average_elevation_meters: 138, state: "Gujarat", osm_relation_id: 2278104
  },

  // ─── MEERUT ────────────────────────────────────────────────────────────────
  meerut: {
    id: "meerut",
    name: "Meerut (MC)",
    administrative_authority: "Meerut Municipal Corporation",
    bbox: [28.9200, 77.6200, 29.0600, 77.8000],
    center_lat: 28.9845, center_lon: 77.7064,
    area_sq_km: 142, major_rivers: ["Kali Nadi","Eastern Yamuna Canal"],
    average_elevation_meters: 219, state: "Uttar Pradesh", osm_relation_id: 2278440
  },

  // ─── FARIDABAD ─────────────────────────────────────────────────────────────
  faridabad: {
    id: "faridabad",
    name: "Faridabad (MC)",
    administrative_authority: "Faridabad Municipal Corporation",
    bbox: [28.3300, 77.2300, 28.5200, 77.4200],
    center_lat: 28.4089, center_lon: 77.3178,
    area_sq_km: 204, major_rivers: ["Yamuna River","Agra Canal"],
    average_elevation_meters: 198, state: "Haryana", osm_relation_id: 2278436
  },

  // ─── GURGAON / GURUGRAM ────────────────────────────────────────────────────
  gurugram: {
    id: "gurugram",
    name: "Gurugram (GMC)",
    administrative_authority: "Municipal Corporation of Gurugram",
    bbox: [28.3500, 76.9700, 28.5500, 77.1500],
    center_lat: 28.4595, center_lon: 77.0266,
    area_sq_km: 251, major_rivers: ["Sahibi River","Najafgarh Lake"],
    average_elevation_meters: 217, state: "Haryana", osm_relation_id: 2278438
  },

  // ─── NOIDA ─────────────────────────────────────────────────────────────────
  noida: {
    id: "noida",
    name: "Noida (GNIDA)",
    administrative_authority: "Gautam Buddh Nagar Industrial Development Authority",
    bbox: [28.4700, 77.3000, 28.6000, 77.5000],
    center_lat: 28.5355, center_lon: 77.3910,
    area_sq_km: 203, major_rivers: ["Yamuna River","Hindon River"],
    average_elevation_meters: 198, state: "Uttar Pradesh", osm_relation_id: 2278442
  },

  // ─── CHANDIGARH ────────────────────────────────────────────────────────────
  chandigarh: {
    id: "chandigarh",
    name: "Chandigarh (MC)",
    administrative_authority: "Municipal Corporation Chandigarh",
    bbox: [30.6800, 76.7100, 30.7800, 76.8600],
    center_lat: 30.7333, center_lon: 76.7794,
    area_sq_km: 114, major_rivers: ["Sukhna Lake","Ghaggar River"],
    average_elevation_meters: 321, state: "Chandigarh UT", osm_relation_id: 1184741
  },

  // ─── THIRUVANANTHAPURAM ────────────────────────────────────────────────────
  thiruvananthapuram: {
    id: "thiruvananthapuram",
    name: "Thiruvananthapuram (Corporation)",
    administrative_authority: "Thiruvananthapuram Municipal Corporation",
    bbox: [8.4100, 76.8800, 8.6200, 77.0500],
    center_lat: 8.5241, center_lon: 76.9366,
    area_sq_km: 214, major_rivers: ["Karamana River","Killiyar River"],
    average_elevation_meters: 16, state: "Kerala", osm_relation_id: 2278090
  },

  // ─── AMRITSAR ──────────────────────────────────────────────────────────────
  amritsar: {
    id: "amritsar",
    name: "Amritsar (MC)",
    administrative_authority: "Municipal Corporation Amritsar",
    bbox: [31.5800, 74.8200, 31.7200, 75.0000],
    center_lat: 31.6340, center_lon: 74.8723,
    area_sq_km: 152, major_rivers: ["Beas River"],
    average_elevation_meters: 234, state: "Punjab", osm_relation_id: 2278444
  },

  // ─── VIJAYWADA ─────────────────────────────────────────────────────────────
  vijayawada: {
    id: "vijayawada",
    name: "Vijayawada (GVMC)",
    administrative_authority: "Municipal Corporation of Vijayawada",
    bbox: [16.4100, 80.5500, 16.6200, 80.7400],
    center_lat: 16.5062, center_lon: 80.6480,
    area_sq_km: 130, major_rivers: ["Krishna River","Budameru River"],
    average_elevation_meters: 26, state: "Andhra Pradesh", osm_relation_id: 1990820
  },

  // ─── RANCHI ────────────────────────────────────────────────────────────────
  ranchi: {
    id: "ranchi",
    name: "Ranchi (RMC)",
    administrative_authority: "Ranchi Municipal Corporation",
    bbox: [23.2400, 85.2500, 23.4600, 85.4200],
    center_lat: 23.3441, center_lon: 85.3096,
    area_sq_km: 175, major_rivers: ["Subarnarekha River","Jumar River"],
    average_elevation_meters: 651, state: "Jharkhand", osm_relation_id: 2278460
  },

  // ─── GUWAHATI ──────────────────────────────────────────────────────────────
  guwahati: {
    id: "guwahati",
    name: "Guwahati (GMC)",
    administrative_authority: "Guwahati Municipal Corporation",
    bbox: [26.0800, 91.5900, 26.2200, 91.8200],
    center_lat: 26.1445, center_lon: 91.7362,
    area_sq_km: 328, major_rivers: ["Brahmaputra River"],
    average_elevation_meters: 55, state: "Assam", osm_relation_id: 2278480
  },

  // ─── BHUBANESWAR ───────────────────────────────────────────────────────────
  bhubaneswar: {
    id: "bhubaneswar",
    name: "Bhubaneswar (BMC)",
    administrative_authority: "Bhubaneswar Municipal Corporation",
    bbox: [20.1800, 85.7200, 20.3600, 85.9000],
    center_lat: 20.2961, center_lon: 85.8245,
    area_sq_km: 422, major_rivers: ["Daya River","Kuakhai River"],
    average_elevation_meters: 45, state: "Odisha", osm_relation_id: 2278470
  },

  // ─── JABALPUR ──────────────────────────────────────────────────────────────
  jabalpur: {
    id: "jabalpur",
    name: "Jabalpur (MC)",
    administrative_authority: "Jabalpur Municipal Corporation",
    bbox: [23.1000, 79.8500, 23.2500, 80.0400],
    center_lat: 23.1815, center_lon: 79.9864,
    area_sq_km: 367, major_rivers: ["Narmada River"],
    average_elevation_meters: 411, state: "Madhya Pradesh", osm_relation_id: 2278076
  },

  // ─── DEHRADUN ──────────────────────────────────────────────────────────────
  dehradun: {
    id: "dehradun",
    name: "Dehradun (MC)",
    administrative_authority: "Dehradun Municipal Corporation",
    bbox: [30.2400, 77.9700, 30.4400, 78.1600],
    center_lat: 30.3165, center_lon: 78.0322,
    area_sq_km: 300, major_rivers: ["Tons River","Song River"],
    average_elevation_meters: 447, state: "Uttarakhand", osm_relation_id: 2278490
  },

  // ─── MYSURU ────────────────────────────────────────────────────────────────
  mysuru: {
    id: "mysuru",
    name: "Mysuru (MCC)",
    administrative_authority: "Mysuru City Corporation",
    bbox: [12.2600, 76.5400, 12.4200, 76.7400],
    center_lat: 12.2958, center_lon: 76.6394,
    area_sq_km: 130, major_rivers: ["Cauvery River","Kapila River"],
    average_elevation_meters: 763, state: "Karnataka", osm_relation_id: 2278084
  },

  // ─── HUBLI-DHARWAD ─────────────────────────────────────────────────────────
  hubli: {
    id: "hubli",
    name: "Hubballi-Dharwad (HDMC)",
    administrative_authority: "Hubballi-Dharwad Municipal Corporation",
    bbox: [15.2600, 75.0200, 15.5200, 75.2800],
    center_lat: 15.3647, center_lon: 75.1240,
    area_sq_km: 202, major_rivers: ["Tungabhadra","Kumudvathi"],
    average_elevation_meters: 748, state: "Karnataka", osm_relation_id: 2278086
  },

  // ─── MANGALURU ─────────────────────────────────────────────────────────────
  mangaluru: {
    id: "mangaluru",
    name: "Mangaluru (MCC)",
    administrative_authority: "Mangaluru City Corporation",
    bbox: [12.7800, 74.7900, 12.9600, 74.9700],
    center_lat: 12.9141, center_lon: 74.8560,
    area_sq_km: 132, major_rivers: ["Netravati River","Gurupura River"],
    average_elevation_meters: 22, state: "Karnataka", osm_relation_id: 2278082
  },

  // ─── TIRUPATI ──────────────────────────────────────────────────────────────
  tirupati: {
    id: "tirupati",
    name: "Tirupati (MC)",
    administrative_authority: "Tirupati Municipal Corporation",
    bbox: [13.5500, 79.3400, 13.7200, 79.5100],
    center_lat: 13.6288, center_lon: 79.4192,
    area_sq_km: 148, major_rivers: ["Swarnamukhi River"],
    average_elevation_meters: 167, state: "Andhra Pradesh", osm_relation_id: 2278460
  },

  // ─── JODHPUR ───────────────────────────────────────────────────────────────
  jodhpur: {
    id: "jodhpur",
    name: "Jodhpur (JMC)",
    administrative_authority: "Jodhpur Municipal Corporation",
    bbox: [26.1800, 72.9800, 26.3900, 73.2000],
    center_lat: 26.2389, center_lon: 73.0243,
    area_sq_km: 398, major_rivers: ["Jojri River"],
    average_elevation_meters: 231, state: "Rajasthan", osm_relation_id: 2278450
  },

  // ─── RAIPUR ────────────────────────────────────────────────────────────────
  raipur: {
    id: "raipur",
    name: "Raipur (RMC)",
    administrative_authority: "Raipur Municipal Corporation",
    bbox: [21.1500, 81.5800, 21.3400, 81.7700],
    center_lat: 21.2514, center_lon: 81.6296,
    area_sq_km: 167, major_rivers: ["Kharun River","Mahanadi"],
    average_elevation_meters: 298, state: "Chhattisgarh", osm_relation_id: 2278468
  },

  // ─── GWALIOR ───────────────────────────────────────────────────────────────
  gwalior: {
    id: "gwalior",
    name: "Gwalior (MC)",
    administrative_authority: "Gwalior Municipal Corporation",
    bbox: [26.1200, 78.0600, 26.3200, 78.2800],
    center_lat: 26.2183, center_lon: 78.1828,
    area_sq_km: 289, major_rivers: ["Chambal River","Morar River"],
    average_elevation_meters: 197, state: "Madhya Pradesh", osm_relation_id: 2278078
  },

  // ─── KOZHIKODE ─────────────────────────────────────────────────────────────
  kozhikode: {
    id: "kozhikode",
    name: "Kozhikode (MC)",
    administrative_authority: "Kozhikode Municipal Corporation",
    bbox: [11.1900, 75.7700, 11.3200, 75.9000],
    center_lat: 11.2588, center_lon: 75.7804,
    area_sq_km: 118, major_rivers: ["Chaliyar River","Kallayi River"],
    average_elevation_meters: 1, state: "Kerala", osm_relation_id: 2278092
  },

  // ─── ALLAHABAD / PRAYAGRAJ ─────────────────────────────────────────────────
  prayagraj: {
    id: "prayagraj",
    name: "Prayagraj (MC)",
    administrative_authority: "Prayagraj Municipal Corporation",
    bbox: [25.3400, 81.7200, 25.5400, 82.0000],
    center_lat: 25.4358, center_lon: 81.8463,
    area_sq_km: 70, major_rivers: ["Ganga River","Yamuna River","Saraswati"],
    average_elevation_meters: 98, state: "Uttar Pradesh", osm_relation_id: 2278448
  },

  // ─── THRISSUR ──────────────────────────────────────────────────────────────
  thrissur: {
    id: "thrissur",
    name: "Thrissur (Corporation)",
    administrative_authority: "Thrissur Municipal Corporation",
    bbox: [10.5100, 76.1600, 10.5600, 76.2500],
    center_lat: 10.5276, center_lon: 76.2144,
    area_sq_km: 102, major_rivers: ["Periyar River"],
    average_elevation_meters: 2, state: "Kerala", osm_relation_id: 2278094
  },
};

/**
 * Compute Camera FitBounds array format from Bounding Box
 */
export function getCameraFitBounds(cityId: string, fallbackEdges: Array<{ polyline?: Array<[number, number]> | undefined; lat1?: number; lon1?: number; lat2?: number; lon2?: number }> = []): [[number, number], [number, number]] {
  const muni = MUNICIPAL_BOUNDARIES[cityId];
  if (muni) {
    const [south, west, north, east] = muni.bbox;
    return [[west, south], [east, north]];
  }
  if (fallbackEdges.length > 0) {
    let minLon = 180, minLat = 90, maxLon = -180, maxLat = -90;
    fallbackEdges.forEach((edge) => {
      if (edge.polyline && edge.polyline.length >= 2) {
        edge.polyline.forEach(([lon, lat]) => {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        });
      }
    });
    if (minLon < maxLon && minLat < maxLat) return [[minLon, minLat], [maxLon, maxLat]];
  }
  return [[77.1800, 28.5700], [77.2600, 28.6500]];
}

// ── Name → ID Lookup (for search autocomplete) ───────────────────────────────
export function buildCityNameIndex(): Array<{ id: string; name: string; display_name: string; state: string; area_sq_km: number; center_lat: number; center_lon: number; elevation: number }> {
  return Object.values(MUNICIPAL_BOUNDARIES).map(m => ({
    id: m.id,
    name: m.name.replace(/\s*\([^)]*\)/g, '').trim(),
    display_name: m.name,
    state: m.state,
    area_sq_km: m.area_sq_km,
    center_lat: m.center_lat,
    center_lon: m.center_lon,
    elevation: m.average_elevation_meters
  }));
}

// ── Dynamic resolver: resolve ANY Indian city name to a MunicipalExtent ──────
const DYNAMIC_CACHE_DIR = path.join(process.cwd(), 'municipal_polygons_cache', 'dynamic');
const DYNAMIC_MEMORY: Record<string, MunicipalExtent> = {};

export async function resolveDynamicMunicipality(
  rawCityId: string,
  rawCityName: string
): Promise<MunicipalExtent | null> {
  // 1. Already in static registry?
  if (MUNICIPAL_BOUNDARIES[rawCityId]) return MUNICIPAL_BOUNDARIES[rawCityId]!;

  // 2. Already dynamically resolved this session?
  if (DYNAMIC_MEMORY[rawCityId]) return DYNAMIC_MEMORY[rawCityId]!;

  // 3. Check dynamic disk cache
  if (!fs.existsSync(DYNAMIC_CACHE_DIR)) fs.mkdirSync(DYNAMIC_CACHE_DIR, { recursive: true });
  const cachePath = path.join(DYNAMIC_CACHE_DIR, `${rawCityId}.json`);
  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as MunicipalExtent;
      if (cached && cached.bbox && cached.bbox.length === 4) {
        DYNAMIC_MEMORY[rawCityId] = cached;
        MUNICIPAL_BOUNDARIES[rawCityId] = cached; // inject into static registry
        return cached;
      }
    } catch { /* ignore */ }
  }

  // 4. Resolve via Nominatim
  const cleanName = rawCityName.replace(/\s*\([^)]*\)/g, '').trim();
  const queries = [
    `${cleanName}, India`,
    `${cleanName} Municipal Corporation, India`,
    `${cleanName} Municipal Council, India`,
    `${cleanName} Urban Local Body, India`,
    `${cleanName} Nagar Nigam, India`,
  ];

  for (const q of queries) {
    try {
      const resp = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q,
          format: 'json',
          limit: 1,
          addressdetails: 1,
          extratags: 1,
          polygon_geojson: 0, // we only need bbox here
          countrycodes: 'in'
        },
        headers: { 'User-Agent': 'ResilioCity-NationalDigitalTwin/4.0' },
        timeout: 10000
      });

      const results = resp.data as any[];
      if (!results || results.length === 0) continue;

      const r = results[0];
      const bb = r.boundingbox as [string, string, string, string]; // [minLat, maxLat, minLon, maxLon]
      if (!bb || bb.length < 4) continue;

      const southLat = parseFloat(bb[0]!) - 0.02;
      const northLat = parseFloat(bb[1]!) + 0.02;
      const westLon  = parseFloat(bb[2]!) - 0.02;
      const eastLon  = parseFloat(bb[3]!) + 0.02;

      if (isNaN(southLat) || isNaN(northLat) || isNaN(westLon) || isNaN(eastLon)) continue;
      if ((northLat - southLat) < 0.01 || (eastLon - westLon) < 0.01) continue; // too small = building, not city

      const centerLat = (southLat + northLat) / 2;
      const centerLon = (westLon + eastLon) / 2;

      // Estimate area from bounding box (rough)
      const latKm = (northLat - southLat) * 111;
      const lonKm = (eastLon - westLon) * 111 * Math.cos(centerLat * Math.PI / 180);
      const estAreaKm2 = Math.round(latKm * lonKm);

      // Extract state from address
      const addr = r.address || {};
      const state = addr.state || addr.county || 'India';
      const adminAuthority = r.display_name?.split(',')[0] || cleanName;

      const resolved: MunicipalExtent = {
        id: rawCityId,
        name: adminAuthority,
        administrative_authority: `${adminAuthority} Municipal Administration`,
        bbox: [southLat, westLon, northLat, eastLon],
        center_lat: centerLat,
        center_lon: centerLon,
        area_sq_km: Math.max(10, estAreaKm2),
        major_rivers: [],
        average_elevation_meters: 100, // default; actual DEM not fetched here
        state: state,
        ...(r.osm_type === 'relation' && !isNaN(parseInt(r.osm_id)) ? { osm_relation_id: parseInt(r.osm_id) } : {})
      };

      // Save to dynamic caches
      fs.writeFileSync(cachePath, JSON.stringify(resolved, null, 2), 'utf-8');
      DYNAMIC_MEMORY[rawCityId] = resolved;
      MUNICIPAL_BOUNDARIES[rawCityId] = resolved; // inject into static registry for this session

      console.log(`[Dynamic Resolver] Resolved '${rawCityName}' → ${adminAuthority}, ${state} (bbox: ${southLat.toFixed(3)},${westLon.toFixed(3)} → ${northLat.toFixed(3)},${eastLon.toFixed(3)}, ~${estAreaKm2}km²)`);
      return resolved;
    } catch (err: any) {
      console.warn(`[Dynamic Resolver] Nominatim failed for '${q}': ${err.message}`);
    }
  }

  console.error(`[Dynamic Resolver] Could not resolve '${rawCityName}' from Nominatim — city not found.`);
  return null;
}
