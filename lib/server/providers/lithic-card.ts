import Lithic from "lithic";

import type {
  CardProvider,
  CreatedProviderCard,
  CreateProviderCardInput,
  UpdateProviderCardInput,
} from "@/lib/server/providers/types";

export class LithicCardProvider implements CardProvider {
  readonly providerName = "lithic";
  readonly mode = "sandbox" as const;

  private readonly client: Lithic;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("LITHIC_API_KEY is not configured");
    }

    this.client = new Lithic({
      apiKey,
      environment: "sandbox",
    });
  }

  async createVirtualCard(
    input: CreateProviderCardInput,
  ): Promise<CreatedProviderCard> {
    const card = await this.client.cards.create({
      type: "VIRTUAL",
      state: "OPEN",
      memo: input.cardholderName,
    });

    return {
      providerCardId: card.token,
      last4: card.last_four,
    };
  }

  async updateCard(input: UpdateProviderCardInput): Promise<void> {
    const update: {
      state?: "OPEN" | "PAUSED";
      spend_limit?: number;
      spend_limit_duration?: "TRANSACTION";
    } = {};
  
    if (input.status !== undefined) {
      update.state = input.status === "active" ? "OPEN" : "PAUSED";
    }
  
    if (input.perTransactionLimitUnits !== undefined) {
      if (input.perTransactionLimitUnits === null) {
        // Lithic uses zero to remove a previously configured limit.
        update.spend_limit = 0;
        update.spend_limit_duration = "TRANSACTION";
      } else {
        // LAD stores micro-USDT. Lithic expects USD cents.
        const microUsdtPerCent = 10_000n;
  
        if (input.perTransactionLimitUnits % microUsdtPerCent !== 0n) {
          throw new Error(
            "Lithic transaction limits must resolve to a whole number of cents.",
          );
        }
  
        const limitCents =
          input.perTransactionLimitUnits / microUsdtPerCent;
  
        if (limitCents > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new Error("Lithic transaction limit is too large.");
        }
  
        update.spend_limit = Number(limitCents);
        update.spend_limit_duration = "TRANSACTION";
      }
    }
  
    await this.client.cards.update(input.providerCardId, update);
  }
  
}

export function createLithicCardProvider(): LithicCardProvider {
  const apiKey = process.env.LITHIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "LITHIC_API_KEY is missing. Add it to your local .env.local file.",
    );
  }

  return new LithicCardProvider(apiKey);
}