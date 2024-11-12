export enum SpecType {
  PASS,
  WARN,
  ERROR,
}

export interface Spec {
  name: string;
  action: string;
  result: string;
  implicit: string[];
  type: SpecType;
  noProvenance: boolean;
}
