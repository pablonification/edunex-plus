// The demo storage's files the phone needs and the pretend world doesn't hold (only demo builds carry this folder):
// the picture in II4091's "Course Tokens" note (the desktop demo draws the same one, scripts/demo/setup.ts), and, with
// EDUNEX_DEMO_FILES=1, two more of a lecturer's files in II4091's Modul 3 to prove every kind opens or says why (W1): a
// Word document, and a PDF the storage names with no extension and no type, which only its first bytes tell.
// All made up; the bytes are written once here (the PNG drawn as the desktop demo draws it, the DOCX with JSZip).

const bytes = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

/** Soft stripes on a card, 640×220. */
export const samplePicture = () =>
  bytes(
    "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",
  );

/** One page: "Rubrik Penilaian Proposal (contoh)" and a line of made-up weights. */
export const sampleDocx = () =>
  bytes(
    "UEsDBAoAAAAIAPeFX13MVIwQ4AAAAJwBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH2Qy07DMBBFf8XyFsUTukAIJekCyhJYlA+w7Eli4Zc8bi" +
      "l/z6QtXaDC0r6PM7rd+hC82GMhl2Ivb1UrBUaTrItTL9+3z829XA/d9isjCbZG6uVca34AIDNj0KRSxsjKmErQlZ9lgqzNh54QVm17BybFirE2" +
      "demQQ/eEo975KjYH/j5hC3qS4vFkXFi91Dl7Z3RlHfbR/qI0Z4Li5NFDs8t0wwYJVwmL8jfgnHvlHYqzKN50qS86sAs+U7Fgk9kFTqr/a67cmc" +
      "bRGbzkl7ZckkEiHjh4dVGCdvHnfjjOPXwDUEsDBAoAAAAAAPeFX10AAAAAAAAAAAAAAAAGAAAAX3JlbHMvUEsDBAoAAAAIAPeFX102V97cogAA" +
      "ABgBAAALAAAAX3JlbHMvLnJlbHONzzsOwjAMBuCrRN6pCwNCqGkXhNQVlQNEiZtGNA8l4XV7MjBQxMBo+/dnuekedmY3isl4x2Fd1cDISa+M0x" +
      "zOw3G1g65tTjSLXBJpMiGxsuIShynnsEdMciIrUuUDuTIZfbQilzJqDEJehCbc1PUW46cBS5P1ikPs1RrY8Az0j+3H0Ug6eHm15PKPE1+JIouo" +
      "KXO4+6hQvdtVYQHbBhcvti9QSwMECgAAAAAA94VfXQAAAAAAAAAAAAAAAAUAAAB3b3JkL1BLAwQKAAAACAD3hV9d4jQIYdcAAAA5AQAAEQAAAH" +
      "dvcmQvZG9jdW1lbnQueG1sbZDRSsQwEEV/JQQEBW26K4qUtvvmkw+L6AdMk2wbN5kJk9Tq35sIIogvd+YylzPD9IeP4MW75eQIB7lrWiksajIO" +
      "50G+vjzePMjD2G+dIb0Gi1mUPKZuG+SSc+yUSnqxAVJD0WKZnYgD5GJ5VhuxiUzaplRwwat9296rAA5lRU5kPmuNVbhKHp/Xid1ZHC06Dw5QHJ" +
      "kiJfDiUhNmWq56VXNV+VvjX8QTZGAxWQ9nwFns7y6uRbCZDHmanbit/g3MVpi72pe7V+9S2VWizT949XOq+n3D+AVQSwECFAAKAAAACAD3hV9d" +
      "zFSMEOAAAACcAQAAEwAAAAAAAAAAAAAAAAAAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUAAoAAAAAAPeFX10AAAAAAAAAAAAAAAAGAAAAAA" +
      "AAAAAAEAAAABEBAABfcmVscy9QSwECFAAKAAAACAD3hV9dNlfe3KIAAAAYAQAACwAAAAAAAAAAAAAAAAA1AQAAX3JlbHMvLnJlbHNQSwECFAAK" +
      "AAAAAAD3hV9dAAAAAAAAAAAAAAAABQAAAAAAAAAAABAAAAAAAgAAd29yZC9QSwECFAAKAAAACAD3hV9d4jQIYdcAAAA5AQAAEQAAAAAAAAAAAA" +
      "AAAAAjAgAAd29yZC9kb2N1bWVudC54bWxQSwUGAAAAAAUABQAgAQAAKQMAAAAA",
  );

const STORAGE = "https://edunexfixture.blob.core.windows.net/edunex";
export const PICTURE_URL = `${STORAGE}/fixture-2`;
export const DOCX_URL = `${STORAGE}/fixture-rubrik-penilaian`;
export const BARE_PDF_URL = `${STORAGE}/fixture-contoh-proposal`;

/** II4091 (Edunex course 95326), its Modul 3 ("Slide Pengantar Proposal TA"). */
export const FILES_MODULE = { courseId: 95326, moduleId: 450219 } as const;

/**
 * A storage answer with its bytes as a stream too, as a real fetch gives it: React Native's own Response (what the
 * pretend world builds) has no `body`, and the app reads a note's picture from the stream (src/desktop/remote-files.ts),
 * so in round 1's demo every picture said "Berkas ini tidak bisa ditampilkan di aplikasi.".
 */
export async function streamed(response: Response): Promise<Response> {
  if (response.body) return response;
  const bytes = new Uint8Array(await response.arrayBuffer());
  const answer = new Response(bytes, { status: response.status, headers: response.headers });
  let read = false;
  const body = {
    getReader: () => ({
      read: async () => (read ? { done: true as const, value: undefined } : ((read = true), { done: false as const, value: bytes })),
      cancel: async () => undefined,
      releaseLock: () => undefined,
    }),
  };
  Object.defineProperty(answer, "body", { value: body });
  return answer;
}
