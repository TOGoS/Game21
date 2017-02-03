interface BitmapFont {
	charWidth: number,
	charHeight: number,
	/**
	 * byte-per-8-bits of all character pixel data
	 * concatenated together.
	 */
	data: Uint8Array|number[]
}

export default BitmapFont;