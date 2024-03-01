declare const name: unique symbol;

export type Name = string & { [name]: never };
