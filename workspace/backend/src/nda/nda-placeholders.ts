export function renderNdaPlaceholders(
  content: string,
  vars: { companyName?: string; clientName?: string; date?: string },
) {
  const date =
    vars.date ||
    new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  return content
    .replaceAll('{{companyName}}', vars.companyName || 'Company')
    .replaceAll('{{clientName}}', vars.clientName || 'Client')
    .replaceAll('{{date}}', date);
}

export const DEFAULT_NDA_CONTENT = `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of {{date}}

BETWEEN

{{companyName}} ("Disclosing Party")

AND

{{clientName}} ("Receiving Party")

1. Purpose
The parties wish to explore a business relationship and may share confidential information.

2. Confidential Information
"Confidential Information" means any non-public information disclosed by either party, including business plans, client data, technical materials, and commercial terms.

3. Obligations
The Receiving Party agrees to:
(a) keep Confidential Information strictly confidential;
(b) use it only for the stated purpose;
(c) not disclose it to third parties without prior written consent.

4. Term
This Agreement remains in effect for three (3) years from the date of signature, unless terminated earlier in writing.

5. Governing Law
This Agreement shall be governed by the applicable laws of the Disclosing Party's jurisdiction.

IN WITNESS WHEREOF, the parties have executed this Agreement as of {{date}}.

────────────────────────────────
Company: {{companyName}}

────────────────────────────────
Client signature: {{clientName}}
Date: {{date}}
`;
