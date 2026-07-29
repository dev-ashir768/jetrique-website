export type PassengerAgeType = "ADULT" | "CHILD" | "INFANT";

// Under 2 → Infant, 2-12 → Child, above 12 → Adult
export function getPassengerTypeFromDob(dob: Date, referenceDate: Date = new Date()): PassengerAgeType {
  let age = referenceDate.getFullYear() - dob.getFullYear();
  const monthDiff = referenceDate.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < dob.getDate())) {
    age--;
  }
  if (age < 2)  return "INFANT";
  if (age < 12) return "CHILD";
  return "ADULT";
}
