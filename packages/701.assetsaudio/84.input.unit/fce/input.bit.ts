export interface InputPromptOptions {
  label?: string;
  defaultText?: string;
  secret?: boolean;
}

export interface InputSubmissionReceipt {
  submitted: boolean;
  cancelled: boolean;
  value: string;
}

export default interface InputBit<TDat = unknown, TLst = string> {
  idx: string;
  src?: string;
  lst?: TLst[];
  val?: number;
  txt?: string;
  dat?: TDat;
  net?: any;
  slv?: (result: { putBit: Partial<InputBit<TDat, TLst>> }) => void;
}
