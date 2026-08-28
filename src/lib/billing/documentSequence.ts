import { prisma } from "@/lib/db/prisma";

export async function nextDocumentNumber(params: {
  companyId: string;
  gstRegistrationId?: string | null;
  branchId?: string | null;
  documentType: string;
  prefix?: string;
}): Promise<string> {
  const fy = getFinancialYear();
  const prefix = params.prefix || buildPrefix(params.documentType, params.companyId);

  const result = await prisma.$transaction(async (tx) => {
    let seq = await tx.documentSequence.findFirst({
      where: {
        companyId: params.companyId,
        gstRegistrationId: params.gstRegistrationId ?? null,
        branchId: params.branchId ?? null,
        documentType: params.documentType,
        financialYear: fy,
      },
    });

    if (!seq) {
      seq = await tx.documentSequence.create({
        data: {
          companyId: params.companyId,
          gstRegistrationId: params.gstRegistrationId ?? null,
          branchId: params.branchId ?? null,
          documentType: params.documentType,
          financialYear: fy,
          prefix,
          nextNumber: 1,
          padding: 5,
        },
      });
    }

    const current = seq.nextNumber;
    await tx.documentSequence.update({
      where: { id: seq.id },
      data: { nextNumber: current + 1 },
    });

    return {
      prefix: seq.prefix,
      number: current,
      padding: seq.padding,
      fy: seq.financialYear,
    };
  });

  const num = String(result.number).padStart(result.padding, "0");
  return `${result.prefix}/${result.fy}/${params.documentType.substring(0, 3).toUpperCase()}/${num}`;
}

function getFinancialYear(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 4) {
    return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
  }
  return `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
}

function buildPrefix(_documentType: string, _companyId: string): string {
  return "LBMT";
}

export { getFinancialYear };
