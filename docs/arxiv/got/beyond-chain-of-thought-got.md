# Summary: Beyond Chain-of-Thought, Effective Graph-of-Thought Reasoning in Language Models (Yao et al.)

This document summarizes the paper "Beyond Chain-of-Thought, Effective Graph-of-Thought Reasoning in Language Models" by Yao Yao, Zuchao Li, and Hai Zhao (arXiv:2305.16582v2).

## Overview and Motivation

*   **Problem:** Existing Chain-of-Thought (CoT) methods model reasoning as sequential chains, which doesn't fully capture the non-linear, graph-like nature of human thought processes (making connections, jumping between ideas).
*   **Proposal (GoT):** Introduce Graph-of-Thought (GoT) reasoning to model thought processes as graphs, where nodes represent thought units and edges represent connections between them.
*   **Goal:** To enable Language Models (LMs) to better simulate human deductive reasoning by incorporating graph structural information, going beyond linear CoT or tree structures (like Tree-of-Thoughts, ToT). This work focuses on *fine-tuning* smaller LMs with integrated graph features.
*   **Contrast with ToT:** While ToT models thoughts as a tree-like search, this GoT aims to *augment* linear CoT reasoning with non-linear graph structures, believing human thought combines both.

## Method

*   **Two-Stage Framework:** Inspired by Multimodal-CoT, it uses a two-stage process:
    1.  **Rationale Generation:** Generates reasoning steps (rationales) based on input text, (optional) vision features, and the constructed thought graph.
    2.  **Answer Generation:** Generates the final answer using the input text concatenated with the predicted rationales, plus vision and graph features.
*   **GoT Construction (ECC Process):**
    *   Proposes an **Extract-Cluster-Coreference (ECC)** process to build the thought graph.
    *   **Extract:** Uses Open Information Extraction (OpenIE) to extract subject-verb-object triplets as initial nodes and edges.
    *   **Cluster & Coreference:** Applies coreference resolution (e.g., Stanford CoreNLP) to identify nodes referring to the same entity and clusters them, replacing nodes in a cluster with a representative mention. This creates a denser, more connected graph reflecting deductive steps (if x -> y and y -> z, then x -> z).
*   **GoT Encoding and Integration:**
    *   **Encoders:** Uses separate encoders for different modalities: Transformer (e.g., T5) for text, a vision encoder (e.g., ViT, DETR) for images (optional), and a dedicated **GoT Encoder** for the thought graph.
    *   **GoT Encoder:** Employs a Graph Attention Network (GAT) with multi-head attention to encode the structural information of the constructed thought graph. Node embeddings are initialized using the text encoder.
    *   **Feature Fusion:** Uses cross-attention to align text representations with image and graph representations. A **gated fusion mechanism** then combines these aligned features before feeding them into the Transformer decoder for rationale/answer prediction.

## Evaluation

*   **Datasets:**
    *   AQUA-RAT (Text-only algebraic word problems)
    *   ScienceQA (Multimodal science questions with text, optional images, and multiple-choice answers)
*   **Models:** Fine-tunes T5-base and T5-large models (specifically FLAN-Alpaca checkpoints).
*   **Baselines:** Compared against Zero-Shot/Few-Shot CoT methods (on GPT-3), fine-tuned models (Calcformer, baseline CoT fine-tuning), VQA models, and Multimodal-CoT.

## Key Results

*   **Significant Improvement:** GoT consistently outperforms strong CoT baselines (especially Multimodal-CoT) on both datasets using the *same backbone model size*.
    *   **AQUA-RAT:** GoT-T5base accuracy +2.00% over baseline CoT fine-tuning. GoT-T5large approaches Few-Shot CoT (GPT-3 175B) performance with far fewer parameters.
    *   **ScienceQA:** GoT-T5base accuracy +2.40% over Multimodal-CoTbase, establishing a new SOTA and exceeding human performance.
*   **Effectiveness of Graph:** Ablation studies confirm the importance of the graph structure. Random graphs or simply concatenating triplets perform worse.
*   **Robustness:** GoT shows better performance on harder, higher-grade questions (ScienceQA) and seems more robust to noisy rationales compared to standard CoT fine-tuning.
*   **Smaller Model Benefit:** The performance gains from GoT appear more pronounced when using smaller backbone models (T5-base) or weaker vision encoders, suggesting GoT effectively leverages language structure when other components are less powerful.

## Key Differences from spcl/graph-of-thoughts

*   **Focus:** This paper focuses on **fine-tuning** models (T5) by deeply integrating graph features via dedicated encoders (GAT) and fusion layers. The spcl/graph-of-thoughts paper focuses on a **framework for prompting** LLMs using a graph of abstract *operations*.
*   **Graph Construction:** This paper proposes a specific **ECC process** (OpenIE + Coreference) to automatically construct the graph from input text/rationales. The spcl/graph-of-thoughts framework defines the graph structure (operations) manually or programmatically based on the problem type.
*   **Mechanism:** This GoT encodes the graph structure itself to augment the model's internal representations. The spcl/graph-of-thoughts uses the graph to orchestrate LLM calls for different reasoning steps (generate, score, aggregate etc.).

## Limitations

*   **Computational Cost:** GoT introduces additional computational cost (graph construction, GAT encoding) compared to standard CoT, leading to slightly slower training/inference times. 