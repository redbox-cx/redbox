import { PrismaService } from 'src/prisma.service';

export type LogicalStorageMetrics = {
  uploadsBytes: number;
  mailBytes: number;
  binsBytes: number;
  totalUsedBytes: number;
};

function toNumber(value: number | bigint | null | undefined) {
  return Number(value ?? 0);
}

export async function getLogicalStorageMetrics(
  prisma: PrismaService,
  since?: Date,
): Promise<LogicalStorageMetrics> {
  const fileWhere = since ? { createdAt: { gte: since } } : undefined;
  const binWhere = since ? { createdAt: { gte: since } } : undefined;
  const mailWhere = since ? { createdAt: { gte: since } } : undefined;
  const attachmentWhere = since ? { mail: { createdAt: { gte: since } } } : undefined;

  const [fileAggregation, binAggregation, mailAggregation, attachmentAggregation] = await Promise.all([
    prisma.file.aggregate({
      where: fileWhere,
      _sum: { size: true },
    }),
    prisma.bin.aggregate({
      where: binWhere,
      _sum: { size: true },
    }),
    prisma.mail.aggregate({
      where: mailWhere,
      _sum: { contentSize: true },
    }),
    prisma.mailAttachment.aggregate({
      where: attachmentWhere,
      _sum: { size: true },
    }),
  ]);

  const uploadsBytes = toNumber(fileAggregation._sum.size);
  const binsBytes = toNumber(binAggregation._sum.size);
  const mailBytes =
    toNumber(mailAggregation._sum.contentSize) + toNumber(attachmentAggregation._sum.size);

  return {
    uploadsBytes,
    mailBytes,
    binsBytes,
    totalUsedBytes: uploadsBytes + mailBytes + binsBytes,
  };
}
