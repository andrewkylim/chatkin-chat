/**
 * Content moderation utilities using Claude API
 */

import type { Anthropic } from '@anthropic-ai/sdk';
import { logger } from './logger';

export interface ModerationResult {
  safe: boolean;
  riskLevel: number; // 0-3 (0=safe, 1=low risk, 2=moderate risk, 3=high risk)
  categories: string[];
  explanation?: string;
}

const UNSAFE_CATEGORIES = [
  'Child Exploitation',
  'Hate Speech',
  'Violence',
  'Sexual Content',
  'Self-Harm',
  'Illegal Activities',
  'Graphic Violence'
];

/**
 * Moderate image content using Claude API
 * Uses Claude Haiku for cost-effectiveness (~$0.000025 per image)
 */
export async function moderateImageContent(
  anthropic: Anthropic,
  imageData: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
): Promise<ModerationResult> {
  const prompt = `You are a content moderation system. Analyze the provided image for unsafe content.

Unsafe content categories:
${UNSAFE_CATEGORIES.map(c => `- ${c}`).join('\n')}

Respond with ONLY a JSON object in this exact format:
{
  "safe": true/false,
  "risk_level": 0-3,
  "categories": ["category1", "category2"],
  "explanation": "brief explanation"
}

Risk levels:
- 0: Safe
- 1: Low risk (borderline)
- 2: Moderate risk (likely violation)
- 3: High risk (clear violation)`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 200,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageData
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }]
    });

    // Extract JSON from response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from moderation API');
    }

    const result = JSON.parse(textContent.text) as {
      safe: boolean;
      risk_level: number;
      categories: string[];
      explanation?: string;
    };

    logger.info('Image moderation completed', {
      safe: result.safe,
      riskLevel: result.risk_level,
      categories: result.categories
    });

    return {
      safe: result.safe,
      riskLevel: result.risk_level,
      categories: result.categories,
      explanation: result.explanation
    };
  } catch (error) {
    logger.error('Image moderation failed', error);
    // Fail-safe: if moderation fails, reject the image
    return {
      safe: false,
      riskLevel: 2,
      categories: ['Moderation Error'],
      explanation: 'Unable to verify content safety'
    };
  }
}
