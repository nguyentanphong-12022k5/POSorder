export interface BankOption {
  code: string;
  name: string;
  shortName: string;
}

export const VIETNAM_BANKS: BankOption[] = [
  { code: "MB", name: "Ngân hàng Quân Đội", shortName: "MBBank" },
  { code: "VCB", name: "Ngân hàng Ngoại Thương Việt Nam", shortName: "Vietcombank" },
  { code: "TCB", name: "Ngân hàng Kỹ Thương", shortName: "Techcombank" },
  { code: "ACB", name: "Ngân hàng Á Châu", shortName: "ACB" },
  { code: "VPB", name: "Ngân hàng Việt Nam Thịnh Vượng", shortName: "VPBank" },
  { code: "TPB", name: "Ngân hàng Tiên Phong", shortName: "TPBank" },
  { code: "BIDV", name: "Ngân hàng Đầu tư và Phát triển", shortName: "BIDV" },
  { code: "CTG", name: "Ngân hàng Công Thương", shortName: "VietinBank" },
  { code: "STB", name: "Ngân hàng Sài Gòn Thương Tín", shortName: "Sacombank" },
  { code: "VIB", name: "Ngân hàng Quốc tế", shortName: "VIB" },
];

/**
 * Sinh đường dẫn ảnh mã QR chuẩn VietQR (Napas 247)
 */
export function getVietQRUrl(params?: {
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  amount?: number;
  description?: string;
}): string {
  const p = params || {};
  const cleanBank = p.bankCode || "MB";
  const cleanAcc = p.accountNumber || "888899998888";
  const cleanName = encodeURIComponent(p.accountName || "TIEM TRA VA CA PHE 88");
  const cleanDesc = encodeURIComponent(p.description || "Thanh toan hoa don");
  const amount = Math.max(0, Math.round(p.amount || 0));

  return `https://img.vietqr.io/image/${cleanBank}-${cleanAcc}-compact2.jpg?amount=${amount}&addInfo=${cleanDesc}&accountName=${cleanName}`;
}
