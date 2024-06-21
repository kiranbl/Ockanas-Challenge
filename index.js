const fs = require('fs');
const pdf = require('pdf-parse');

// Function to extract text from a PDF file using pdf-parse module
let extractTextFromPDF = async (pdfPath)=>  {
    const dataBuffer = fs.readFileSync(pdfPath);
    try {
        const pdfData = await pdf(dataBuffer);
        return pdfData.text;
    } catch (error) {
        console.error('Error parsing PDF:', error);
        throw error;
    }
}
// Function takes the text and processes each line based on the pattern regex and then returns an array of objects.
let processText = (text) =>{
    const mainPatternRegex = /^\s*(\d+\.\s*—?\s*(\([\d\w]+\))?)\s*/u; // Main pattern like '40.—(1)', '41.' with optional spaces
    const subPatternRegex = /^\s*\(\s*(\d+)\s*\)/u; // Subpatterns like (2), (3), etc., with optional spaces
    const keywordRegex = /\b(must|should|shall)\b/i;
    let results = [];

    let lines = text.split('\n'); // Split text into lines

    let currentMainPattern = null;
    let currentSubPattern = null;
    let currentText = '';
    let currentMainPatternText = '';
    let previousLine = ''; // Variable to store the previous line

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim(); // Trim leading and trailing whitespace

        const matchMainPattern = line.match(mainPatternRegex);
        const matchSubPattern = line.match(subPatternRegex);

        if (matchMainPattern) {
            // Found a new main pattern, process the previous accumulated text
            if (currentMainPattern !== null) {
                processCurrentText(previousLine, currentMainPattern, currentMainPatternText, results, keywordRegex);
            }

            // Reset for the new pattern
            currentMainPattern = matchMainPattern[1].trim();
            currentMainPatternText = line.replace(currentMainPattern, '').trim();
            currentSubPattern = null;

            // Update previousLine to the current line before processing it
            if (i > 0) {
                previousLine = lines[i - 1].trim(); // Get the previous line or an empty string if it doesn't exist
            } else {
                previousLine = ''; // If it's the first line, there's no previous line
            }
        } else if (matchSubPattern && currentMainPattern !== null) {
            // Found a subpattern like (2), (3), etc., after the main pattern
            const subPatternNumber = matchSubPattern[1];

            if (currentSubPattern !== null) {
                processCurrentText(previousLine, `${currentMainPattern} ${currentSubPattern}`, currentText, results, keywordRegex);
            }

            currentSubPattern = `(${subPatternNumber})`;
            currentText = line.replace(subPatternRegex, '').trim();

            // Continue accumulating lines until the next main pattern or subpattern
            let nextLineIndex = i + 1;
            while (nextLineIndex < lines.length) {
                let nextLine = lines[nextLineIndex].trim();
                if (nextLine.match(mainPatternRegex) || nextLine.match(subPatternRegex)) {
                    break;
                }
                currentText += ' ' + nextLine;
                nextLineIndex++;
            }

            // Move the index back by one to process the next main or subpattern correctly
            i = nextLineIndex - 1;
        } else {
            // Accumulate lines if no new pattern is found
            currentMainPatternText += ' ' + line;
        }
    }

    // Process the last accumulated text for the main pattern
    if (currentMainPattern !== null && currentMainPatternText.trim() !== '') {
        processCurrentText(previousLine, currentMainPattern, currentMainPatternText, results, keywordRegex);
    }

    // Process the last accumulated text for the subpattern
    if (currentSubPattern !== null && currentText.trim() !== '') {
        processCurrentText(previousLine, `${currentMainPattern} ${currentSubPattern}`, currentText, results, keywordRegex);
    }

    return results;
}
// Function to process the text and push the object to the results array.
let processCurrentText=(section, clauseNumber, text, results, keywordRegex) =>{
    const followingText = text.trim();

    if (followingText.match(keywordRegex)) {
        const requirementType = followingText.match(keywordRegex)[0];
        results.push({
            'section': section,
            'clause number': clauseNumber,
            'text': followingText,
            'requirement type': requirementType
        });
    }
}

// Function to convert array of objects to CSV format
let convertArrayToCSV = (data) => {
    if (data.length === 0) {
        return ''; // Return empty string if data array is empty
    }

    const header = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(','));
    return `${header}\n${rows.join('\n')}`;
}

// Main function to run the program
let main = async (pdfPath, outputPath) =>{
    try {
        const extractedText = await extractTextFromPDF(pdfPath);
        const processedData = processText(extractedText);
        const csvOutput = convertArrayToCSV(processedData);

        // Write CSV output to file
        fs.writeFileSync(outputPath, csvOutput);
        console.log(`CSV data has been written to ${outputPath}`);
    } catch (error) {
        console.error('Error:', error);
    }
}
//Variables to store the file path for pdf and the output csv
const pdfPath = 'PER.pdf';
const outputPath = 'OUTPUT.csv';

// Calling main function
main(pdfPath, outputPath);

