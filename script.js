const jurisdictionToVariants = {
    "NOT_APPLICABLE": ["rtp-variant88", "rtp-variant91", "rtp-variant93", "rtp-variant94", "rtp-variant95", "rtp-variant96", "solid95", "rtp-variant94+_circus", "rtp96_Playfortuna"],
    "SOCIAL": ["rtp88_SOCIAL", "rtp91_SOCIAL", "rtp93_SOCIAL", "rtp94_SOCIAL", "rtp95_SOCIAL", "rtp96_SOCIAL", "rtp96_High5Casino_SOCIAL", "rtp94_SOCIAL_Pulsz"],
    "MT": ["rtp88_MT", "rtp91_MT", "rtp93_MT", "rtp94_MT", "rtp95_MT", "rtp96_MT", "rtp94+_MT_circus"],
    "CZ": ["rtp88_CZ", "rtp91_CZ", "rtp93_CZ", "rtp94_CZ", "rtp95_CZ", "rtp96_CZ"],
    "RO": ["rtp88_RO", "rtp91_RO", "rtp93_RO", "rtp94_RO", "rtp95_RO", "rtp96_RO"],
    "CH": ["rtp88_CH", "rtp91_CH", "rtp93_CH", "rtp94_CH", "rtp95_CH", "rtp96_CH"],
    "LV": ["rtp88_CH", "rtp91_CH", "rtp93_CH", "rtp94_CH", "rtp95_CH", "rtp96_CH"],
    "BR": ["rtp88_BR", "rtp91_BR", "rtp93_BR", "rtp94_BR", "rtp95_BR", "rtp96_BR"],
    "DE": ["rtp88_DE", "rtp91_DE"],
    "IT": ["rtp91_IT", "rtp93_IT", "rtp94_IT", "rtp95_IT", "rtp96_IT"],
    "ES": ["rtp88_ES", "rtp91_ES", "rtp93_ES", "rtp94_ES", "rtp95_ES", "rtp96_ES", "rtp94+_ES_Casino_Barcelona"],
    "NL": ["rtp88_NL", "rtp91_NL", "rtp93_NL", "rtp94_NL", "rtp95_NL", "rtp96_NL", "rtp94+_NL_circus"],
    "PT": ["rtp88_PT", "rtp91_PT", "rtp93_PT", "rtp94_PT", "rtp95_PT", "rtp96_PT"],
    "HR": ["rtp88_HR", "rtp91_HR", "rtp93_HR", "rtp94_HR", "rtp95_HR", "rtp96_HR"],
    "BG": ["rtp88_BG", "rtp91_BG", "rtp93_BG", "rtp94_BG", "rtp95_BG"],
    "SE": ["rtp88_SE", "rtp91_SE", "rtp93_SE", "rtp94_SE", "rtp95_SE", "rtp96_SE"],
    "UK": ["rtp88_UK", "rtp91_UK", "rtp93_UK", "rtp94_UK", "rtp95_UK"],
    "SK": ["rtp88_SK", "rtp91_SK", "rtp93_SK", "rtp94_SK", "rtp95_SK", "rtp96_SK"]
  };
  
const checkedByDefault = new Set(["NOT_APPLICABLE", "SOCIAL"]);
  
const jurisdictionContainer = document.getElementById("jurisdictionContainer");
jurisdictionContainer.className = "row"; 

for (const jur in jurisdictionToVariants) {
    const colDiv = document.createElement("div");
    colDiv.className = "col-2 mb-2"; 
  
    const formCheckDiv = document.createElement("div");
    formCheckDiv.className = "form-check";
  
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `jur_${jur}`;
    checkbox.value = jur;
    checkbox.className = "form-check-input";
  
    if (checkedByDefault.has(jur)) checkbox.checked = true;
  
    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.textContent = jur;
    label.className = "form-check-label";
  
    formCheckDiv.appendChild(checkbox);
    formCheckDiv.appendChild(label);
    colDiv.appendChild(formCheckDiv);
    jurisdictionContainer.appendChild(colDiv);
}
  
let originalData = {};
  
document.getElementById("fileInput").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
        try {
            originalData = JSON.parse(evt.target.result);
            document.getElementById("output").value = JSON.stringify(originalData, null, 2);
            alert("JSON loaded successfully!");
        } catch (err) {
            alert("Invalid JSON file.");
            }
    };

    reader.readAsText(file);
});
  
function addGame() {
    const gameName = document.getElementById("gameName").value.trim();
    if (!gameName) return alert("Enter a game name");
  
    const paths = {
        "88": document.getElementById("path88").value.trim(),
        "91": document.getElementById("path91").value.trim(),
        "93": document.getElementById("path93").value.trim(),
        "94": document.getElementById("path94").value.trim(),
        "95": document.getElementById("path95").value.trim(),
        "96": document.getElementById("path96").value.trim()
    };
  
    Object.keys(jurisdictionToVariants).forEach(jur => {
        const checkbox = document.getElementById(`jur_${jur}`);
        if (!checkbox.checked) return;
  
        jurisdictionToVariants[jur].forEach(variant => {
        if (!originalData[variant]) originalData[variant] = { games: {} };
        if (!originalData[variant].games[gameName]) {
            originalData[variant].games[gameName] = { jurisdictions: {} };
        } else {
            if (!originalData[variant].games[gameName].jurisdictions) {
            originalData[variant].games[gameName].jurisdictions = {};
            }
        }
  
        const rtpMatch = variant.match(/(\d{2})/);
        if (!rtpMatch) return;
        const rtp = rtpMatch[1];
        const path = paths[rtp];
        if (!path) return;
  
        originalData[variant].games[gameName].jurisdictions[jur] = { gameModelFile: path };
  
        const sortedGames = {};
        Object.keys(originalData[variant].games).sort().forEach(key => {
            sortedGames[key] = originalData[variant].games[key];
        });
        
        originalData[variant].games = sortedGames;
        });
    });
  
    document.getElementById("output").value = JSON.stringify(originalData, null, 2);
}

    function copyOutput() {
        const output = document.getElementById("output");
        navigator.clipboard.writeText(output.value)
          .then(() => alert("JSON copied to clipboard! 😊"))
          .catch(err => alert("Copy failed 😞"));
      }