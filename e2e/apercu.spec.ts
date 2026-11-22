import { expect, test } from "@playwright/test";
import { publicJson } from "./helpers";

type Year = { fires: { id: number; commune: string; areaHa: number }[] };
const largest2022 = publicJson<Year>("effis/fires-2022.json").fires.reduce((best, f) => (f.areaHa > best.areaHa ? f : best));

test("un feu partagé a son titre et son image d'aperçu pour les réseaux sociaux", async ({ request }) => {
  const page = await request.get(`/carte?annee=2022&fire=${largest2022.id}`, {
    headers: { "user-agent": "facebookexternalhit/1.1" },
  });
  const head = (await page.text()).split("</head>")[0];
  expect(head).toContain(`og:title" content="Feu de ${largest2022.commune}`);
  const image = head.match(/og:image" content="([^"]+)"/)?.[1];
  expect(image).toContain(`/api/apercu/feu/${largest2022.id}?annee=2022`);
  const png = await request.get(new URL(image!).pathname + new URL(image!).search);
  expect(png.status()).toBe(200);
  expect(png.headers()["content-type"]).toBe("image/png");
});

test("un feu inconnu n'a pas d'image", async ({ request }) => {
  expect((await request.get("/api/apercu/feu/1?annee=2022")).status()).toBe(404);
});
