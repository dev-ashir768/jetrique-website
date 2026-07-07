export function maskPhone(raw: string): string {
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");

  if (hasPlus) {
    if (digits.startsWith("92")) {
      const n = digits.slice(2);
      if (n.length <= 3) return `+92 ${n}`;
      return `+92 ${n.slice(0, 3)} ${n.slice(3, 10)}`;
    }
    return `+${digits.slice(0, 15)}`;
  }

  if (digits.startsWith("0")) {
    const n = digits.slice(1);
    if (n.length <= 3) return `0${n}`;
    return `0${n.slice(0, 3)} ${n.slice(3, 10)}`;
  }

  return digits.slice(0, 15);
}

export function maskCnic(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}
