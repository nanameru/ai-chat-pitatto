import { Step, Workflow } from "@mastra/core/workflows";
import { z } from "zod";
import OpenAI from "openai";

// Step 1: Analyze sentiment of text
const analyzeTextStep = new Step({
  id: "analyzeText",
  description: "Analyzes text sentiment (positive/negative/neutral)",
  execute: async ({ context }) => {
    const text = context.triggerData.inputText;
    if (!text) {
      throw new Error("No input text provided");
    }
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const prompt = `Please classify the sentiment of the following text as "positive", "negative", or "neutral". Only output the sentiment classification:

"${text}"`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 10
    });
    
    const sentiment = completion.choices[0].message.content?.toLowerCase().trim() || "neutral";
    
    // Normalize sentiment
    let normalizedSentiment;
    if (sentiment.includes("positive")) {
      normalizedSentiment = "positive";
    } else if (sentiment.includes("negative")) {
      normalizedSentiment = "negative";
    } else {
      normalizedSentiment = "neutral";
    }
    
    return {
      text,
      sentiment: normalizedSentiment
    };
  }
});

// Step 2A: Handle positive sentiment
const handlePositiveSentimentStep = new Step({
  id: "handlePositive",
  description: "Generates a response for positive sentiment",
  execute: async ({ context }) => {
    const analyzeResult = context.getStepResult<{ text: string, sentiment: string }>("analyzeText");
    
    if (!analyzeResult) {
      return { response: "Sentiment analysis result not found" };
    }
    
    if (analyzeResult.sentiment !== "positive") {
      return { response: "This step only processes positive sentiment" };
    }
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const prompt = `Generate a warm and appreciative response to the following positive comment:

"${analyzeResult.text}"`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 200
    });
    
    return {
      originalText: analyzeResult.text,
      sentiment: analyzeResult.sentiment,
      response: completion.choices[0].message.content || "Thank you for your positive feedback!"
    };
  }
});

// Step 2B: Handle negative sentiment
const handleNegativeSentimentStep = new Step({
  id: "handleNegative",
  description: "Generates a response for negative sentiment",
  execute: async ({ context }) => {
    const analyzeResult = context.getStepResult<{ text: string, sentiment: string }>("analyzeText");
    
    if (!analyzeResult) {
      return { response: "Sentiment analysis result not found" };
    }
    
    if (analyzeResult.sentiment !== "negative") {
      return { response: "This step only processes negative sentiment" };
    }
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const prompt = `Generate an empathetic response that acknowledges concerns and offers solutions to the following negative comment:

"${analyzeResult.text}"`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 300
    });
    
    return {
      originalText: analyzeResult.text,
      sentiment: analyzeResult.sentiment,
      response: completion.choices[0].message.content || "We apologize for any inconvenience. We are committed to addressing your concerns."
    };
  }
});

// Step 2C: Handle neutral sentiment
const handleNeutralSentimentStep = new Step({
  id: "handleNeutral",
  description: "Generates a response for neutral sentiment",
  execute: async ({ context }) => {
    const analyzeResult = context.getStepResult<{ text: string, sentiment: string }>("analyzeText");
    
    if (!analyzeResult) {
      return { response: "Sentiment analysis result not found" };
    }
    
    if (analyzeResult.sentiment !== "neutral") {
      return { response: "This step only processes neutral sentiment" };
    }
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const prompt = `Generate a polite response that seeks more information for the following neutral comment:

"${analyzeResult.text}"`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 200
    });
    
    return {
      originalText: analyzeResult.text,
      sentiment: analyzeResult.sentiment,
      response: completion.choices[0].message.content || "Thank you for your message. Could you please provide more details?"
    };
  }
});

// Step 3: Generate additional suggestions (for neutral and negative only)
const generateSuggestionStep = new Step({
  id: "generateSuggestion",
  description: "Generates additional suggestions for negative or neutral sentiment",
  execute: async ({ context }) => {
    const analyzeResult = context.getStepResult<{ text: string, sentiment: string }>("analyzeText");
    
    if (!analyzeResult) {
      return { suggestion: "" };
    }
    
    if (analyzeResult.sentiment === "positive") {
      return { suggestion: "" };
    }
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const prompt = `Suggest three helpful resources or additional information related to the following text, in bullet point format:

"${analyzeResult.text}"`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 200
    });
    
    return {
      suggestion: completion.choices[0].message.content || "No additional suggestions at this time."
    };
  }
});

// Step 4: Generate follow-up actions (for positive only)
const generateFollowUpStep = new Step({
  id: "generateFollowUp",
  description: "Generates follow-up actions for positive sentiment",
  execute: async ({ context }) => {
    const analyzeResult = context.getStepResult<{ text: string, sentiment: string }>("analyzeText");
    
    if (!analyzeResult) {
      return { followUp: "" };
    }
    
    if (analyzeResult.sentiment !== "positive") {
      return { followUp: "" };
    }
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const prompt = `Based on the following positive comment, suggest one next step or recommendation to further increase user engagement:

"${analyzeResult.text}"`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 150
    });
    
    return {
      followUp: completion.choices[0].message.content || "Please continue to share your feedback with us."
    };
  }
});

// Final step: Combine results from all branches
const finalIntegrationStep = new Step({
  id: "finalIntegration",
  description: "Integrates all branch results to generate the final response",
  execute: async ({ context }) => {
    const analyzeResult = context.getStepResult<{ text: string, sentiment: string }>("analyzeText");
    
    if (!analyzeResult) {
      return { finalResponse: "Text analysis failed. Please try again." };
    }
    
    let response = "";
    let additionalInfo = "";
    
    // Get appropriate response based on sentiment type
    if (analyzeResult.sentiment === "positive") {
      const positiveResult = context.getStepResult<{ response: string }>("handlePositive");
      response = positiveResult?.response || "";
      
      const followUpResult = context.getStepResult<{ followUp: string }>("generateFollowUp");
      additionalInfo = followUpResult?.followUp || "";
    } else if (analyzeResult.sentiment === "negative") {
      const negativeResult = context.getStepResult<{ response: string }>("handleNegative");
      response = negativeResult?.response || "";
      
      const suggestionResult = context.getStepResult<{ suggestion: string }>("generateSuggestion");
      additionalInfo = suggestionResult?.suggestion || "";
    } else {
      const neutralResult = context.getStepResult<{ response: string }>("handleNeutral");
      response = neutralResult?.response || "";
      
      const suggestionResult = context.getStepResult<{ suggestion: string }>("generateSuggestion");
      additionalInfo = suggestionResult?.suggestion || "";
    }
    
    // Add metadata
    return {
      originalText: analyzeResult.text,
      detectedSentiment: analyzeResult.sentiment,
      primaryResponse: response,
      additionalInformation: additionalInfo,
      finalResponse: `${response}${additionalInfo ? `\n\n${additionalInfo}` : ""}`,
      timestamp: new Date().toISOString()
    };
  }
});

// Sentiment analysis workflow definition
export const branchingSentimentWorkflow = new Workflow({
  name: "test-branchingSentimentWorkflow",
  triggerSchema: z.object({
    inputText: z.string().min(1).describe("Text to analyze"),
  }),
});

// Build workflow with complex branching paths
branchingSentimentWorkflow
  // First step: Sentiment analysis
  .step(analyzeTextStep)
  
  // Branch 1: Process positive sentiment
  // @ts-ignore TypeScriptが判断できない特殊なAPIのため型チェックを無視
  .then((context) => {
    const result = context.getStepResult("analyzeText");
    return result?.sentiment === "positive";
  }, handlePositiveSentimentStep)
  
  // Branch 2: Process negative sentiment
  // @ts-ignore TypeScriptが判断できない特殊なAPIのため型チェックを無視
  .then((context) => {
    const result = context.getStepResult("analyzeText");
    return result?.sentiment === "negative";
  }, handleNegativeSentimentStep)
  
  // Branch 3: Process neutral sentiment
  // @ts-ignore TypeScriptが判断できない特殊なAPIのため型チェックを無視
  .then((context) => {
    const result = context.getStepResult("analyzeText");
    return result?.sentiment === "neutral";
  }, handleNeutralSentimentStep)
  
  // Additional step for positive sentiment only
  .after(handlePositiveSentimentStep)
  .step(generateFollowUpStep)
  
  // Additional step for negative or neutral sentiment
  .after([handleNegativeSentimentStep, handleNeutralSentimentStep])
  .step(generateSuggestionStep)
  
  // Combine all branches
  .after([generateFollowUpStep, generateSuggestionStep])
  .step(finalIntegrationStep)
  .commit(); 