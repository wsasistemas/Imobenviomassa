export type DocusignAmbiente = "demo" | "producao";

export function docusignAdminUrl(ambiente: DocusignAmbiente, path: string): string {
  const base =
    ambiente === "producao" ? "https://admin.docusign.com" : "https://admindemo.docusign.com";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function docusignConsentBaseUrl(ambiente: DocusignAmbiente): string {
  return ambiente === "producao"
    ? "https://account.docusign.com"
    : "https://account-d.docusign.com";
}
