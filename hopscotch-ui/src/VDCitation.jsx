// src/VDCitation.jsx
// APA-style "How to cite" line shown under the H4-All logo on every visual
// design diagram. The retrieval date is generated at render/print time so
// downloads always carry the current date.
import React from "react";

export default function VDCitation() {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return (
    <div className="vd-citation">
      <strong>How to cite:</strong> Jorrín-Abellán, I. M., Kunuku, M. T., Noble-Healy, J., Dehbozorgi, N., Chang,
      M., Vásquez, A., Zhang, X., Koz, O., &amp; González Suárez, R. (n.d.). <em>Hopscotch 4-All</em> [Web
      application]. Interactive Research Methods Lab, Kennesaw State University. Retrieved {date}, from
      https://hopscotch4all.com
    </div>
  );
}
