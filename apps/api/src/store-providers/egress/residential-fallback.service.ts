import { Injectable, Logger } from '@nestjs/common';
import { ProxyTier } from '@prisma/client';
import { Dispatcher } from 'undici';
import { proxyDispatcher } from './egress';
import { ProxyLedger } from './proxy-ledger.service';
import { ProxyPoolConfig } from './proxy-pool.config';
import { maxRequests, spendMonth, spendUsd } from './residential-spend';

export class ResidentialCapReached extends Error {
  constructor(
    readonly ceiling: number,
    readonly capUsd: number,
  ) {
    super(
      `residential egress refused: the monthly ${capUsd} USD cap of ${ceiling} requests is spent`,
    );
    this.name = 'ResidentialCapReached';
  }
}

export interface ResidentialSpend {
  month: string;
  requests: number;
  usd: number;
  capUsd: number;
}

@Injectable()
export class ResidentialFallback {
  private readonly logger = new Logger(ResidentialFallback.name);
  private dispatcher?: Dispatcher;

  constructor(
    private readonly ledger: ProxyLedger,
    private readonly config: ProxyPoolConfig,
  ) {}

  get configured(): boolean {
    return Boolean(this.config.residentialUrl);
  }

  async claim(): Promise<Dispatcher | null> {
    const url = this.config.residentialUrl;
    if (!url) return null;

    const month = spendMonth();
    if (await this.exhausted(month)) {
      this.logger.error(
        `residential fallback refused: ${month} spend is at the ${this.tariff.monthlyCapUsd} USD cap of ${this.ceiling} requests`,
      );
      return null;
    }

    this.dispatcher ??= proxyDispatcher(
      url,
      this.config.residentialCredentials,
    );
    return this.dispatcher;
  }

  async admit(): Promise<void> {
    const admitted = await this.ledger.claim(
      ProxyTier.RESIDENTIAL,
      1,
      this.ceiling,
      spendMonth(),
    );
    if (admitted) return;
    throw new ResidentialCapReached(this.ceiling, this.tariff.monthlyCapUsd);
  }

  private async exhausted(month: string): Promise<boolean> {
    const ceiling = this.ceiling;
    if (ceiling <= 0) return true;
    return (await this.ledger.count(ProxyTier.RESIDENTIAL, month)) >= ceiling;
  }

  private get tariff() {
    return this.config.residentialTariff;
  }

  private get ceiling(): number {
    return maxRequests(this.tariff);
  }

  async spend(): Promise<ResidentialSpend> {
    const month = spendMonth();
    const requests = await this.ledger.count(ProxyTier.RESIDENTIAL, month);
    return {
      month,
      requests,
      usd: spendUsd(requests, this.config.residentialTariff),
      capUsd: this.config.residentialTariff.monthlyCapUsd,
    };
  }
}
