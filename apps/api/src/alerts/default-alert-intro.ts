import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DefaultAlertIntro {
  constructor(private readonly prisma: PrismaService) {}

  async claim(emailAlertId: string, now = new Date()): Promise<Date | null> {
    const claimed = await this.prisma.emailAlert.updateMany({
      where: { id: emailAlertId, defaultOrigin: true, introSentAt: null },
      data: { introSentAt: now },
    });
    return claimed.count > 0 ? now : null;
  }

  async restore(emailAlertId: string, claimedAt: Date): Promise<void> {
    await this.prisma.emailAlert.updateMany({
      where: { id: emailAlertId, introSentAt: claimedAt },
      data: { introSentAt: null },
    });
  }
}
