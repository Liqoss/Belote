
import Jimp from "jimp";
import path from "path";
import fs from "fs";

const cards = ["jack", "queen", "king"];
const inputDir = path.resolve("./public/cards");
const TARGET_SIZE = 512;

async function createMasks() {
    for (const card of cards) {
        try {
            const inputPath = path.join(inputDir, `${card}.png`);
            if (!fs.existsSync(inputPath)) {
                console.error(`File not found: ${inputPath}`);
                continue;
            }

            console.log(`Processing ${card}...`);
            const image = await Jimp.read(inputPath);


            // 1. Autocrop to get the tightest bound of the "ink"
            // We need to be careful with threshold to ignore light noise
            image.autocrop({ tolerance: 0.1, cropOnlyFrames: false });

            // Create final canvas
            const canvas = new Jimp(TARGET_SIZE, TARGET_SIZE, 0x00000000);

            if (card === 'king') {
                // King already has a border. Scale to fit fully.
                image.scaleToFit(TARGET_SIZE, TARGET_SIZE);
                
                // Center
                const x = (TARGET_SIZE - image.bitmap.width) / 2;
                const y = (TARGET_SIZE - image.bitmap.height) / 2;
                canvas.composite(image, x, y);

            } else {
                // Jack and Queen have no border. 
                // We want them to look like the King: consistent size within a border.
                
                // Scale content to be slightly smaller than full size to leave room for border
                // and match the King's "internal" scale.
                // Assuming King's border takes ~20px each side, content is ~470px.
                // Let's scale J/Q to ~450px height/width to be safe and centered.
                image.scaleToFit(450, 450);
                
                // Center content
                const x = (TARGET_SIZE - image.bitmap.width) / 2;
                const y = (TARGET_SIZE - image.bitmap.height) / 2;
                canvas.composite(image, x, y);

                // Add Border (Draw a rectangle)
                // Jimp doesn't have a simple "drawRect" for thick lines easily without plugins?
                // We can scan and set pixels for the border.
                const borderThickness = 12; // Match King's approximate thickness
                const borderPadding = 0; // At the edge
                
                const width = canvas.bitmap.width;
                const height = canvas.bitmap.height;

                canvas.scan(0, 0, width, height, function(x, y, idx) {
                    // Check if we are in the border region
                    const isBorder = (x < borderThickness) || (x >= width - borderThickness) ||
                                     (y < borderThickness) || (y >= height - borderThickness);
                    
                    if (isBorder) {
                        this.bitmap.data[idx + 0] = 0;   // R (Black)
                        this.bitmap.data[idx + 1] = 0;   // G
                        this.bitmap.data[idx + 2] = 0;   // B
                        this.bitmap.data[idx + 3] = 255; // Alpha (Opaque)
                    }
                });
            }

            // 4. Convert to Transparent Mask
            // Note: We run this on the composite canvas now
            canvas.scan(0, 0, canvas.bitmap.width, canvas.bitmap.height, function(x, y, idx) {
                const r = this.bitmap.data[idx + 0];
                const g = this.bitmap.data[idx + 1];
                const b = this.bitmap.data[idx + 2];
                const a = this.bitmap.data[idx + 3]; // We need alpha now
                
                // 1. If it's already fully transparent (canvas background), leave it alone.
                if (a < 10) return;

                // 2. If it's white/light (paper background of the source image), make it transparent.
                if (r > 150 && g > 150 && b > 150) {
                    this.bitmap.data[idx + 3] = 0; // Transparent
                } else {
                    // 3. It's visible and dark (ink or border) -> Keep Opaque
                    this.bitmap.data[idx + 3] = 255; // Force full opacity
                    
                    // Normalize color to black for the mask source safety
                    this.bitmap.data[idx + 0] = 0;
                    this.bitmap.data[idx + 1] = 0;
                    this.bitmap.data[idx + 2] = 0;
                }
            });

            await canvas.writeAsync(inputPath);
            console.log(`Normalized/Bordered ${card} mask saved.`);
            
        } catch (err) {
            console.error(`Error processing ${card}:`, err);
        }
    }
}

createMasks();
