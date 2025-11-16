export function generateRandomString(length: number = 100): string {
	const rand = new Uint8Array(Math.ceil((length * 6) / 8)); // base64 is 6 bits, so 6X/8 is the target length of 8bit ints
	crypto.getRandomValues(rand);
	return rand
		.toBase64({ alphabet: "base64url", omitPadding: true })
		.slice(0, length);
}
