export type ReschedulingStrategy = 'next_working_day' | 'previous_working_day' | 'closest_working_day';
export type SplitStrategy = 'maximum_amount_split' | 'equal_split';

export interface CompanyPolicy {
  id: string;
  companyId: string;
  splitThresholdAmount: number;
  maximumCheckAmount: number;
  dailyMaximumPayoutAmount: number;
  checkIntervalDays: number;
  issueNotificationLeadDays: number;
  receiptNotificationLeadDays: number;
  cashPreparationLeadDays: number;
  approvalTimeoutHours: number;
  reschedulingStrategy: ReschedulingStrategy;
  splitStrategy: SplitStrategy;
  workingDays: number[];
  effectiveFrom?: string;
}

export interface UpdatePolicyPayload {
  splitThresholdAmount: number;
  maximumCheckAmount: number;
  dailyMaximumPayoutAmount: number;
  checkIntervalDays: number;
  issueNotificationLeadDays: number;
  receiptNotificationLeadDays: number;
  cashPreparationLeadDays: number;
  approvalTimeoutHours: number;
  reschedulingStrategy: ReschedulingStrategy;
  splitStrategy: SplitStrategy;
  workingDays: number[];
  effectiveFrom?: string;
}
