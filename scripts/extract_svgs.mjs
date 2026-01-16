import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

// Source is the new repo file
const SVG_FILE = './temp_cards_repo/svg-cards.svg';
const OUT_DIR = './public/cards';

// Map specific IDs from the atlas to our desired filenames
// Atlas IDs: {club,diamond,heart,spade}_{jack,queen,king}
// Desired: {rank}_{suit}.svg (e.g. jack_spades.svg)
const SUITS = ['club', 'diamond', 'heart', 'spade'];
const RANKS = ['jack', 'queen', 'king'];

// Suit name mapping if necessary (atlas uses singular, we might want plural or specific codes)
// But let's stick to simple names: jack_club.svg, etc. 
// User code uses 'S', 'H', 'D', 'C'. 
// Let's create a map for cleaner filenames if we want:
const SUIT_MAP = {
    'club': 'clubs',
    'diamond': 'diamonds',
    'heart': 'hearts',
    'spade': 'spades'
};

// Function to create a standalone SVG from a symbol/group
// The README says natural dims: width: 169.075, height: 244.64
const VIEWBOX = "0 0 169.075 244.64";

async function run() {
    console.log(`Reading SVG from ${SVG_FILE}...`);
    if (!fs.existsSync(SVG_FILE)) {
        console.error("Source file not found!");
        process.exit(1);
    }
    const xml = fs.readFileSync(SVG_FILE, 'utf8');
    const dom = new JSDOM(xml, { contentType: "text/xml" });
    const doc = dom.window.document;

    if (!fs.existsSync(OUT_DIR)) {
        fs.mkdirSync(OUT_DIR, { recursive: true });
    }

    // Extract global definitions
    const defsElement = doc.querySelector('defs');
    if (!defsElement) {
        console.error("No <defs> found in source SVG!");
        process.exit(1);
    }
    const defsContent = defsElement.innerHTML;

    for (const suit of SUITS) {
        for (const rank of RANKS) {
            const id = `${suit}_${rank}`; // e.g. club_jack
            const element = doc.getElementById(id);
            
            if (!element) {
                console.error(`Could not find element #${id}`);
                continue;
            }

            console.log(`Extracting ${id}...`);

            // Remove rank indicators (letters/numbers) from the element before extracting
            // They are typically <use xlink:href="#jack" ...> or <use xlink:href="#n_10" ...>
            // We want to keep the face image but remove the corner indicators.
            // Based on inspection, IDs to look for are: jack, queen, king, ace, n_2, n_3... n_10
            
            const uses = element.querySelectorAll('use');
            for (const use of uses) {
                const href = use.getAttribute('xlink:href') || use.getAttribute('href');
                if (href) {
                    const targetId = href.replace('#', '');
                    const unwantedIds = [
                        'jack', 'queen', 'king', 'ace', 
                        'n_2', 'n_3', 'n_4', 'n_5', 'n_6', 'n_7', 'n_8', 'n_9', 'n_10', 'n_1',
                        'club', 'diamond', 'heart', 'spade', // Suit symbols
                        'base' // Card border/background
                    ];
                    
                    if (unwantedIds.includes(targetId)) {
                        console.log(`Removing element ${targetId} from ${id}`);
                        use.remove();
                    }
                }
            }
            
            let content = element.outerHTML;
            
            let svgStr = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${VIEWBOX}" width="169" height="244">
    <defs>${defsContent}</defs>
    ${content}
</svg>`;

            const outName = `${rank}_${SUIT_MAP[suit]}.svg`; // e.g. jack_clubs.svg
            fs.writeFileSync(path.join(OUT_DIR, outName), svgStr);
            console.log(`Saved ${outName}`);
        }
    }
}

run();
