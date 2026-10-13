// A licence's text on the licences page (src/app/licences.ts): licence files
// break their lines wider than the page's column, so within a paragraph a line
// runs on into the next and the column wraps it, with nothing left alone on a
// line; titles, list items and copyright lines keep their own line. The shapes
// below are those of the real files the app ships (MIT, BSD, Apache, and
// licences copied from source code with comment marks), with made-up names.
import { describe, expect, it } from "vitest";
import { licenceParagraphs } from "../../src/app/licences";

describe("a licence's text, in paragraphs for the page", () => {
  it("runs a paragraph's lines on, as the file meant them", () => {
    const text = [
      "MIT License",
      "",
      "Copyright (c) 2026 Example Authors",
      "",
      "Permission is hereby granted, free of charge, to any person obtaining a copy",
      'of this software and associated documentation files (the "Software"), to deal',
      "in the Software without restriction.",
    ].join("\r\n");
    expect(licenceParagraphs(text)).toEqual([
      "MIT License",
      "Copyright (c) 2026 Example Authors",
      'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction.',
    ]);
  });

  it("keeps a title's short lines, each list item and each copyright line on their own line", () => {
    const text = [
      "                                 Apache License",
      "                           Version 2.0, January 2004",
      "",
      "Copyright (c) 2002-2014, Example University, Belgium, and its many contributors",
      "Copyright (c) 2003-2009, Example Person",
      "",
      "Redistribution and use in source and binary forms, with or without",
      "modification, are permitted provided that the following conditions are met:",
      "1. Redistributions of source code must retain the above copyright notice, this",
      "   list of conditions and the following disclaimer.",
      "2. Redistributions in binary form must reproduce the above copyright notice.",
    ].join("\n");
    expect(licenceParagraphs(text)).toEqual([
      "Apache License\nVersion 2.0, January 2004",
      "Copyright (c) 2002-2014, Example University, Belgium, and its many contributors\nCopyright (c) 2003-2009, Example Person",
      "Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:\n" +
        "1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.\n" +
        "2. Redistributions in binary form must reproduce the above copyright notice.",
    ]);
  });

  it("leaves out the comment marks of a licence copied from source code", () => {
    const slashes = [
      "// Copyright 2014 Example Authors",
      "//",
      "// Redistribution and use in source and binary forms, with or without",
      "// modification, are permitted provided that the following conditions are",
      "// met:",
      "//",
      "//    * Redistributions of source code must retain the above copyright",
      "// notice, this list of conditions and the following disclaimer.",
    ].join("\n");
    expect(licenceParagraphs(slashes)).toEqual([
      "Copyright 2014 Example Authors",
      "Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:",
      "* Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.",
    ]);
    const comment = ["/*", " * The copyright in this software is being made available under the 2-clauses ", " * BSD License, included below.", " */"].join(
      "\n",
    );
    expect(licenceParagraphs(comment)).toEqual(["The copyright in this software is being made available under the 2-clauses BSD License, included below."]);
    const cmaps = ["%%Copyright: Copyright 1990-2009 Example Systems Incorporated.", "%%Copyright: All rights reserved.", "%%Copyright:"].join("\n");
    expect(licenceParagraphs(cmaps)).toEqual(["Copyright 1990-2009 Example Systems Incorporated. All rights reserved."]);
  });

  it("keeps a centred title on its own line, even straight after a full line of the licence before it", () => {
    // pdf.js's PDFium licence: a BSD licence, then an Apache licence with no empty line between them.
    const text = [
      "// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT",
      "// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.",
      "                                 Apache License",
      "                           Version 2.0, January 2004",
    ].join("\n");
    expect(licenceParagraphs(text)).toEqual([
      "THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.\nApache License\nVersion 2.0, January 2004",
    ]);
  });

  it("leaves a paragraph that was never broken whole, and keeps the rule between two files' licences", () => {
    const long = `This agreement governs the use of the Software. ${"It goes on in one line. ".repeat(30).trim()}`;
    expect(licenceParagraphs(`${long}\n\n---\n\nlib/web/fetch/LICENSE:\n\nMIT License`)).toEqual([long, "---", "lib/web/fetch/LICENSE:", "MIT License"]);
  });
});
