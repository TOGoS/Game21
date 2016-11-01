/** Basically an OSC messge: [path, arg0, arg1...etc] */
export type InternalBusMessage = any[];

export interface InternallyBussed {
	enqueuedBusMessages? : InternalBusMessage[];
}

export default InternalBusMessage;
