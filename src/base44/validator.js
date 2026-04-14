/**
 * Base44 Input Validator
 * Zod schema for the generate-site payload
 */
const { z } = require('zod');

const generateSiteSchema = z.object({
    // Required
    businessName: z.string().min(1, 'businessName required'),

    // Optional with defaults
    industry: z.string().default('business'),
    location: z.string().default('South Africa'),
    positioning: z.string().default(''),
    lekkeSlaapLink: z.string().url().optional().or(z.literal('')),

    // Folder structure
    townFolder: z.string().optional(),
    categoryFolder: z.string().optional(),
    targetRootDir: z.string().optional(),

    // Behavior
    runHeadless: z.boolean().default(false),

    // Optional lead reference
    leadId: z.union([z.number(), z.string()]).optional(),
});

/**
 * Validate input data. Returns { success, data, error }
 */
function validateInput(rawData) {
    const result = generateSiteSchema.safeParse(rawData);
    if (!result.success) {
        const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
        return { success: false, data: null, error: messages.join('; ') };
    }
    return { success: true, data: result.data, error: null };
}

module.exports = { generateSiteSchema, validateInput };
