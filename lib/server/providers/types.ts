import type { CardStatus, ProviderMode } from "@/lib/contracts";

export type ProviderCardStatus = Extract<
  CardStatus,
  "active" | "frozen"
>;

export type CreateProviderCardInput = {
  userId: string;
  cardholderName: string;
};

export type CreatedProviderCard = {
  providerCardId: string;
  last4: string;
};


export type UpdateProviderCardInput = {
    providerCardId: string;
    status?: ProviderCardStatus;
    perTransactionLimitUnits?: bigint | null;
  };

export interface CardProvider {
  readonly providerName: string;
  readonly mode: ProviderMode;

  createVirtualCard(
    input: CreateProviderCardInput
  ): Promise<CreatedProviderCard>;

  updateCard(
    input: UpdateProviderCardInput
  ): Promise<void>;
}