// TODO: replace every entry in this file with real content/photos/links.
// Centralized here so Footer, Coordinators, Leadership, and Administration
// all stay in sync until the real data is supplied.

import chairmanPhoto from "../images/logo/leadership/chairman-bg.jpeg";
import directorPhoto from "../images/logo/leadership/director.jpg";
import thirdLeaderPhoto from "../images/logo/leadership/Screenshot 2026-08-06 134756.png";
import principalPhoto from "../images/adminstration/principle.jpeg";
import vicePrincipalPhoto from "../images/adminstration/vice-principle.jpeg";

// Real photos supplied in src/images/logo/leadership/ — names/titles are
// TODO until the user provides them; using role-only labels in the meantime
// rather than inventing a name for a real, identifiable person.
export const leadership = [
  { name: "Dr. N. Sesha Reddy Sir", role: "Chairman", org: "Aditya Degree Colleges", photo: chairmanPhoto },
  { name: "Dr. BEVL Naidu Sir", role: "Director", org: "Aditya Degree Colleges", photo: directorPhoto },
  { name: "Dr. N. Suguna Madam", role: "Secretary (ADC)", org: "Aditya Degree Colleges", photo: thirdLeaderPhoto },
];

export const administration = [
  { name: "M . Satya Prakash Sir", role: "Principal", org: "Aditya Degree College (Co-Ed), Gajuwaka", photo: principalPhoto },
  { name: "R . V . R . Patrudu Sir", role: "Vice Principal", org: "Aditya Degree College (Co-Ed), Gajuwaka", photo: vicePrincipalPhoto },
/*   { name: "Placeholder Name", role: "Sponsorship Head" }, */
];

export const coordinators = [
  { name: "M. Lavanya Madam", phone: "6281134730", role:"Faculty - Computer Science",photo: principalPhoto },
  { name: "J . Haritha Madam", phone: "6304321629", role: "Coordinator",photo: vicePrincipalPhoto },
  { name: "G . Dwarakesh reddy", phone: "6309596158", role: "Student Coordinator",photo: thirdLeaderPhoto },
  { name: "E . Prem Sai", phone: "9603328067", role: "Student Coordinator",photo: chairmanPhoto },
];
