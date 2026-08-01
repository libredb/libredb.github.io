// Single source of truth for the vendor behind LibreDB. "LibreDB" is a product
// brand, not a legal entity: the company that develops, publishes and
// commercially supports it is Sekoya. Partner programmes and certification
// reviews verify the vendor from the product website, so every surface that
// names the vendor (status bar, JSON-LD, privacy policy, humans.txt) derives
// from this file rather than restating it.
//
// The values are ASCII on purpose — no Turkish diacritics. Application forms
// are frequently ASCII-only and reviewers match the address on the form against
// the website character for character, so this must stay byte-identical to the
// address published on sekoya.tech. Do not "correct" the spelling to Turkish.

export const VENDOR = {
  legalName: 'Sekoya Grup Bilisim ve Teknoloji Ltd. Sti.',
  tradeName: 'Sekoya Tech',
  url: 'https://sekoya.tech',
  /** Same @id as the organization node on sekoya.tech, so the two sites describe one entity. */
  schemaId: 'https://sekoya.tech/#organization',
  companyInfoUrl: 'https://sekoya.tech/contact/#company-information',
  email: 'info@sekoya.tech',
  taxOffice: 'Umraniye',
  taxId: '7591146987',
  mersisNo: '0759114698700001',
  tradeRegistryNo: '1015843',
} as const;

const VENDOR_ADDRESS = {
  street: 'Inkilap Mah. Hasim Iscan Sok. Kent Sitesi F Blok No: 4/33',
  postalCode: '34768',
  district: 'Umraniye',
  city: 'Istanbul',
  country: 'Turkiye',
  countryCode: 'TR',
} as const;

/** Street line, for footers that break the address over two lines. */
export const VENDOR_ADDRESS_STREET = VENDOR_ADDRESS.street;

/** "34768 Umraniye / Istanbul, Turkiye" — the locality half of the address. */
export const VENDOR_LOCALITY = `${VENDOR_ADDRESS.postalCode} ${VENDOR_ADDRESS.district} / ${VENDOR_ADDRESS.city}, ${VENDOR_ADDRESS.country}`;

/** Full single-line address, for JSON-LD and the plain-text files. */
export const VENDOR_ADDRESS_FULL = `${VENDOR_ADDRESS.street}, ${VENDOR_LOCALITY}`;

/** schema.org PostalAddress for the vendor's registered office. */
const vendorPostalAddress = {
  '@type': 'PostalAddress',
  streetAddress: VENDOR_ADDRESS.street,
  addressLocality: `${VENDOR_ADDRESS.postalCode} ${VENDOR_ADDRESS.district}`,
  addressRegion: VENDOR_ADDRESS.city,
  postalCode: VENDOR_ADDRESS.postalCode,
  addressCountry: VENDOR_ADDRESS.countryCode,
} as const;

/**
 * schema.org Organization node for the vendor. Referenced by @id from the
 * WebApplication and LibreDB Organization nodes so a crawler resolves the
 * publisher to a legally identified company with a verifiable address.
 */
export const vendorOrganizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': VENDOR.schemaId,
  name: VENDOR.tradeName,
  legalName: VENDOR.legalName,
  url: VENDOR.url,
  email: VENDOR.email,
  address: vendorPostalAddress,
  taxID: VENDOR.taxId,
  vatID: VENDOR.taxId,
  identifier: [
    { '@type': 'PropertyValue', name: 'MERSIS No', value: VENDOR.mersisNo },
    { '@type': 'PropertyValue', name: 'Trade Registry No', value: VENDOR.tradeRegistryNo },
  ],
} as const;
