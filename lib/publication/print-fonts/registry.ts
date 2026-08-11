/**
 * Governed print Font Inputs (Print blueprint §13): exact
 * repository-controlled files identified by checksum, with embedding
 * authority evidenced by the committed SIL OFL 1.1 license texts. A
 * missing file, checksum mismatch, or absent license evidence fails
 * production closed — no system-font substitution exists anywhere.
 */

export interface FontInput {
  fontKey: string;
  family: string;
  style: string;
  postscriptName: string;
  sha256: string;
  licenseId: "OFL-1.1";
  licenseEvidence: string;
}

export const FONT_INPUTS: Record<string, FontInput> = {
  "newsreader-regular": {
    fontKey: "newsreader-regular",
    family: "Newsreader",
    style: "Regular",
    postscriptName: "Newsreader-Regular",
    sha256: "b8f5e0a8bdd6a12c722ca5635d9da87e77ccbb2d0172112e34e00c4e55f2cd5a",
    licenseId: "OFL-1.1",
    licenseEvidence: "lib/publication/print-fonts/OFL-newsreader.txt",
  },
  "newsreader-italic": {
    fontKey: "newsreader-italic",
    family: "Newsreader",
    style: "Italic",
    postscriptName: "Newsreader-Italic",
    sha256: "a7a0a9114e29fbf6e83a339ed930d5d8ae69fe4217c34fdd95386d995929d6e8",
    licenseId: "OFL-1.1",
    licenseEvidence: "lib/publication/print-fonts/OFL-newsreader.txt",
  },
  "newsreader-bold": {
    fontKey: "newsreader-bold",
    family: "Newsreader",
    style: "Bold",
    postscriptName: "Newsreader-Bold",
    sha256: "81d90be46eec4aefac9cf507352f96c4890dbbcb0f7a390091545c1df06f16c6",
    licenseId: "OFL-1.1",
    licenseEvidence: "lib/publication/print-fonts/OFL-newsreader.txt",
  },
  "fraunces-regular": {
    fontKey: "fraunces-regular",
    family: "Fraunces",
    style: "Regular",
    postscriptName: "Fraunces-Regular",
    sha256: "3eb6cf0a14feb1876cc464fa093af4e0c5b05dc46dec65619c1d95f2a1ab5aa7",
    licenseId: "OFL-1.1",
    licenseEvidence: "lib/publication/print-fonts/OFL-fraunces.txt",
  },
};
