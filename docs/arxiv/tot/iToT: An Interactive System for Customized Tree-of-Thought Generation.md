HTML conversions sometimes display errors due to content that did not convert correctly from the source. This paper uses the following packages that are not yet supported by the HTML conversion tool. Feedback on these issues are not necessary; they are known and are being worked on.

failed: tabu
failed: mwe
Authors: achieve the best HTML results from your LaTeX submissions by following these best practices.

License: arXiv.org perpetual non-exclusive license
arXiv:2409.00413v1 [cs.HC] 31 Aug 2024
\onlineid
0 \vgtccategoryResearch \vgtcinsertpkg \teaser [Uncaptioned image] The iToT workflow: During initialization, the user provides an input prompt describing the task, examples of successful sequences of thoughts, and an evaluation prompt with self-evaluation criteria. They also specify the model parameters and visualization settings (1). During the generation process, the parametrized model produces a set of ranked candidate thoughts. The user can expand on these model-generated thoughts or add a new custom thought (2). Finally, iToT offers evaluation: thoughts are ranked by the model’s self-evaluation and assessed based on their semantic similarity and self-consistency (3).

iToT: An Interactive System for Customized Tree-of-Thought Generation
Alan Boyle
These authors contributed equally to this work
Isha Gupta∗
Sebastian Hönig∗
Lukas Mautner∗
Kenza Amara

Furui Cheng
and Mennatallah El-Assady
Department of Computer Science
ETH Zürich
Abstract
As language models have become increasingly successful at a wide array of tasks, different prompt engineering methods have been developed alongside them in order to adapt these models to new tasks. One of them is Tree-of-Thoughts (ToT), a prompting strategy and framework for language model inference and problem-solving. It allows the model to explore multiple solution paths and select the best course of action, producing a tree-like structure of intermediate steps (i.e., thoughts). This method was shown to be effective for several problem types. However, the official implementation has a high barrier to usage as it requires setup overhead and incorporates task-specific problem templates which are difficult to generalize to new problem types. It also does not allow user interaction to improve or suggest new thoughts. We introduce iToT (interactive Tree-of-Thoughts), a generalized and interactive Tree of Thought prompting system. iToT allows users to explore each step of the model’s problem-solving process as well as to correct and extend the model’s thoughts. iToT revolves around a visual interface that facilitates simple and generic ToT usage and transparentizes the problem-solving process to users. This facilitates a better understanding of which thoughts and considerations lead to the model’s final decision. Through three case studies, we demonstrate the usefulness of iToT in different human-LLM co-writing tasks.

keywords: Natural Language Interface, Tree-of-Thoughts, Large Language Model
Introduction

Interest in large language models (LLMs) has grown tremendously in recent years and taken both the research community as well as the general public by storm [22] [25] [26]. They have demonstrated proficiency in numerous tasks once considered extremely challenging or entirely unsuitable for machine-learning systems. For instance, they excel in handling various logical and mathematical reasoning tasks, particularly those involving only a few logical steps to reach a conclusion [21] [10].

However, despite their strengths, LLMs often struggle to answer certain types of complex questions that require planning and exploration [12]. Moreover, the black-box nature of LLMs complicates the possibility for humans to understand the reasoning process behind the model’s decisions.

This has led to the development of prompting techniques that transparentize the LLM’s inference process, like Chain-of-Thought (CoT) [28], which guides the model to emulate a step-by-step reasoning process. CoT allows the model to iteratively build towards the correct conclusion instead of outputting it immediately, which further allows a user to analyze the model’s reasoning process and identify potential shortcomings. Tree-of-Thoughts (ToT) [32] addresses the linear limitation of the CoT approach by prompting the model to come up with multiple thoughts at each step. It thus allows the LLM to explore multiple reasoning paths simultaneously through iterative self-evaluation of the output choices.

However, ToT, as presented in the original work, is limited to specific tasks and requires the users to write code to adapt this technique to new tasks, and thus has limited usability to solve real-world problems. The original ToT implementation runs automatically without the option for user-guided discovery and without showing the resulting tree to the user. It thus cannot adapt to user preferences nor profit from the user’s knowledge and does not leverage the transparent nature of ToT as a reasoning process. Hence, we explore how to build a general-purpose ToT system with user-guided discovery that allows the user to observe the entire reasoning process.

Extending ToT to a general-purpose system presents several challenges. Firstly, it requires replacing the task-specific code with an intuitive task input format while still maintaining the fidelity of ToT. Secondly, the model may produce multiple thoughts at a given step that express the same idea, leading to duplicated options. We use the idea of semantic equivalence to reduce the elements shown to users by grouping the thoughts sharing the same idea (e.g., logically entail each other). Finally, the interface design poses a tradeoff between providing the user with sufficient information and control to interact with the system meaningfully, whilst simultaneously not overwhelming them with redundant data.

We introduce iToT (Interactive Tree-of-Thoughts). iToT allows users to input any task and interact with the model’s thoughts through a web interface. This enables transparency and contrastive reasoning: users can visualize various potential model outputs comparatively along with the quality scores assigned to each path by the model, revealing the trade-offs faced by the model and the thoughts it ultimately follows. Concretely, our contributions are the following:

• An interactive visualization system1, with a tree-based visualization of the ToT generation paths and natural-language-based interactions to help LLM users control and customize the ToT generation process.
• A semantic node grouping method to alleviate duplicated options, which makes the tree-based display more scalable with the number of branches in the generation process and also provides an indication of output consistency.
• Three use cases that demonstrate the usage of iToT in human-AI co-writing tasks, including problem-solving and planning.
1Literature Review
Prompting Techniques. Due to the ability of LLMs to solve an array of tasks going far beyond text generation, a considerable research effort into how these models can be made better at solving increasingly complex problems has been kick-started. Prompt engineering has proven particularly well suited for this pursuit, as it is much easier, faster, and cheaper to implement than LLM fine-tuning, and can elicit measurably improved results in many types of benchmarks. [15] and [8] summarize a number of such prompting strategies. Aside from simple strategies like input-output, impersonation [24] and ask-me-anything [4], more and more involved techniques are being developed. Among the most prominent of these is chain-of-thought (CoT) [28], along with its variants like zero-shot CoT [16] and self-consistency CoT [27]. All CoT-like prompting applications share the same basic idea: They ask the model to “think out loud” about the answer it is about to give. Consequently, the model reasons about the various sub-steps required to arrive at its final answer, instead of simply generating it. This increases the chances of a factually correct and semantically consistent response through beacons of information in the thoughts that are eventually used in the final response [19]. Least-to-most prompting [34] has been proposed as a way to elicit complex reasoning in LLMs. Other attempts at this have been made by self-refine [18] and self-evaluation guided beam search [30]. Especially CoT, self-consistency CoT, and self-evaluation guided beam search have served as inspiration for tree-of-thoughts (ToT) [32], which in turn serves as the basis for our work. Apart from ToT, other advanced prompting strategies and frameworks have also been developed, such as graph-of-thoughts [5] and retrieval-augmented generation [17, 14]. Our method improves directly upon ToT by allowing users to tackle more than just the original three tasks proposed in [32] without having to write custom Python code.

LLM Interfaces. There has also been substantial work on visualizing LLMs and their outputs. On the technical side, [2] offers an interface displaying the process of how an LLM works, allowing the user to interact with the model’s building blocks. Building on CoT, [29] proposes visualization-of-thought in an attempt to increase the spatial reasoning capabilities of LLMs and produce visualizations of their thoughts in the process. In order to reduce the barrier to entry for users that wish to interact with LLMs in a more controlled way, Low-Code LLM [7] offers a visual programming interface that allows the construction of custom workflows. [1] offers a curated list of graphical user interfaces designed for interaction with one or multiple LLMs in a purely chat-based way. More nuanced interactions with LLMs are made possible for example by [33], which introduces Wordcraft, an interface that allows the user to engage in co-writing with an LLM. Another example is Graphologue [13], which converts an LLM’s textual response into an interactive diagram, enabling the user to explore logical and associative relationships between parts of the response and display relevant sources. Following a similar idea, RELIC [9] inspects the model’s self-concistency and visualizes different paths within a sentence in the response using a tree-like structure, while highlighting supporting and contradicting evidence from various rounds of sampling. These visualizations, however, all support LLM applications in which either CoT prompting or no particular prompting strategy is employed. As of right now, no interface exists that is tailored specifically to the ToT paradigm. To remedy this, we propose iToT. The important difference between our method and existing, standard LLM interfaces is our display of the generated tree of thoughts, along with the produced self-evaluation rankings, instead of a standard chat interface.

Refer to caption
Figure 1:The landing page features onboarding guidance (1) and some example tasks for a quick start (2). The sidebar leads to the user history and tree settings (3). There is an input field for the main prompt (task description) (4) as well as the two system prompts (5).
2iToT System Design
iToT is an interactive dashboard in the form of a web application. The main page (shown in Figure 1) first serves as a landing page explaining the ToT approach with some example tasks. Once the user inputs their own prompts, the landing page is rearranged to display the resulting tree (shown in Figure 3) wherein the majority of the user interaction happens. The sidebar offers peripheral functions such as the settings (shown in Figure 2) and a history of the created trees. The layout is intended to emulate popular chatbot tools such as ChatGPT to allow users to easily orient themselves. We offer OpenAI’s GPT models (GPT-3.5 Turbo [6], GPT-4 [3] and GPT-4o [20]) to serve as the LLMs in our application. For the semantic grouping (which will be explained later) we use an SBERT [23] based model as the sequence embedder for the embedding-based similarity measure and a DeBERTa [11] based NLI model for the logic-based similarity measure 2.

2.1Users and Tasks
We envision three types of users for iToT: lay users, ML engineers, and LLM researchers. Their specific needs and conceptual models were integrated into our system design. Lay users may use iToT to produce an output of better quality compared to other methods. ML engineers are interested in finding the best ToT prompting strategy for a certain task. They might want to try different combinations of prompts and ToT settings to find the best solution for the ML problem type they want to solve. LLM researchers are interested in investigating the advantages and disadvantages of the ToT prompting strategy in an open-ended manner. They may be interested in understanding all the different settings and prompt types as well as comparing the ToT output to the output resulting from a classic prompting strategy.

2.2ToT Interaction Overview
To generate a ToT, the user begins by inputting the main prompt describing the task, alongside two system prompts. Before generating the tree the user can also change the settings for tree generation. This part is described in detail in Section 2.

Once the model receives the prompts it generates a set of candidate thoughts, which are then evaluated by the model and grouped according to a similarity metric by an external model. The thoughts are then displayed to the user alongside the ranking provided by the model, with grouped thoughts displayed in a stacked fashion. This process is then iterated as the user chooses a thought to be expanded and the model generates possible continuations for the path that the thought belongs to. Sections 2.4 and 2.5 explain these two steps of generation and evaluation in detail and also describe how they are communicated to the user.

2.3iToT Initialization
Refer to caption
Figure 2:iToT enables users to configure the ToT process through the Setting Panel.
Initial and Dynamic Tree Settings. The tree’s initial settings (shown in Figure 2) can be assigned once when initializing the tree and cannot be changed afterward. These initial settings include temperature, grouping method, generation method, evaluation method, and thought selection method. We delineate these from dynamic settings, which appear in a popup window in the top right in Figure 3 and can be changed at any time in the tree exploration. The dynamic settings include how many thoughts should be generated and how many of those should be displayed per layer. All settings mirror the ones that were used in [32].

Editable System Prompts. The original Tree-of-Thoughts paper [32] uses task-specific prompts to 1. initialize the tree, 2. prompt the model for follow-up thoughts and 3. for the thought evaluation. We refer to these prompts as the system prompts. In iToT these prompts are adapted to have a fixed part and an editable part. The fixed part is the same for all inputs and sets up the model to follow the ToT approach in a generic fashion. The editable part consists of two prompts that are inserted into the fixed parts to further tailor the model’s responses to the task at hand. These two prompts are:

• The Example prompt: This prompt shows the model examples of what a successful path in the tree could look like, akin to the examples in few-shot-prompting.
• The Evaluation prompt: This prompt provides the criteria with which the model should evaluate its own thoughts.
These prompts can be provided alongside the main prompt which is the prompt describing the user’s task, i.e., the standard input prompt users are familiar with from other applications to initialize the tree. If the user does not want to provide these editable system prompts, default alternatives are used instead, ensuring a low barrier to entry. Through this decomposition, iToT is able to handle arbitrary input while still having the flexibility to be tailored to the task at hand.

2.4Thought Generation
Refer to caption
Figure 3:The user is enabled to interact with the model’s thought process by adding new thoughts (1) and dynamically changing the settings for each generated layer (2). The user’s ”active path”, i.e. the one being currently explored, is highlighted yellow (3) and they can expand and collapse subtrees for readability (4). The model supplies insights and explainability back to the user: Similar thoughts are grouped (a) and thought generation is accompanied by real-time status updates (b). The user can view the model’s ranking of the generated thoughts (c) and the model’s preferred path is highlighted green.
The main component of iToT is the computed Tree-of-Thought. The series of thoughts generated creates a relational dataset. We opt for a node-link style diagram where the vertices are arranged to depict the hierarchy of the content. This is a natural choice as the order of thought generation must be apparent for the user to gather information from the chart. Therefore, each node has direct lines to its 
n
 children in the next layer of the tree, where 
n
 is between 2 and 5 and can be chosen by the user for each layer. The entire tree is placed within a scrollable, zoomable field so that the user can adjust the view depending on which information they are interested in. An example of a generated tree is depicted in Figure 3. In the following, we expand on the most important design decisions of the tree component.

Expandable/Collapsible Thoughts. As the total number of nodes in the tree grows exponentially in the number of layers, an important tree interaction feature is the ability to hide a subset of the nodes for legibility. When a group of children has been generated for a thought, we change the “generate” button to a “collapse/expand” toggle for all the node’s children.

Preferred/Active Paths. We use color to identify the paths of interest in the current tree. The path highlighted in green is the one that the model itself has evaluated as the most fruitful path to the solution – the so-called “preferred” path. The path highlighted in yellow is the one for which the user has most recently generated a new set of thoughts, which we call the “active” path. This color encoding makes it easier for the user to stay focused on the important and current information in the tree.

Addition of User’s Custom Thoughts. An important additonal feature of iToT is the ability to add a new custom thought if the user thinks that an important step is missing in the problem-solving process. In iToT, the user can click a blue “+” icon to the right of any layer and add a new thought to this set of thoughts. The children for this added thought are also immediately generated. This allows the user to collaborate with the model to tailor the problem-solving process and arrive at the desired solution, emphasizing the mixed-initiative aspect of iToT. It also allows the users to append thoughts that may be too original, novel, or unusual for the model to produce by itself.

2.5Thought Evaluation
Thought Ranking. After a set of candidate subsequent thoughts is generated for a thought, the model is asked to evaluate them either in a comparative or individual manner. This evaluation is shown to the user alongside the thoughts as a ranking. The user can therefore gain insights into what the model deemed to be a good or bad step. This information is useful both for tweaking settings as well as understanding the model’s thought process and limitations of the settings. Furthermore, the system provides the option to use this evaluation when selecting the subset of generated thoughts to be displayed (known as ”greedy” thought selection) - however, this selection can also be based on random sampling.

Semantic Grouping. We empirically noted that in some types of tasks, particularly where the answer space is fairly restricted, the model often generates several thoughts that are semantically equivalent. For example, the two thoughts “The astronaut’s astonishment grew as he pondered the incongruity of the seared steak aroma in the weightless expanse of space” and “As he floated through space, he couldn’t help but wonder why the smell of seared steak lingered in the vacuum”; or the two thoughts “RILLE” and “Rille”. To prevent user attention from being overwhelmed by redundant path options, we incorporate a mechanism to perform semantic grouping. Herein, the generated thoughts are passed through a semantic equivalence filter before being displayed. Thoughts considered equivalent by this similarity criteria are displayed in a stacked fashion, but can also be expanded manually by the user for inspection. The grouping threshold can be changed in the settings and the user can also choose whether the grouping should happen based on similarity of sequence embeddings or logical inference. Importantly, this feature offers explainability and supports users in understanding the semantic variations of the different branches in ToT. It indicates how sure the model is of a certain response, particularly in highly constrained tasks such as a crossword or math problem. This is further discussed in Section 4.

2.6User Onboarding
An important design paradigm in interactive ML is how the users can best be informed about the current state of the system and guided in their system exploration. Several features of iToT address this.

Onboarding Guidance. We offer user guidance at the beginning of every tree creation. This includes a brief explanation of Tree-of-Thoughts prompting, a link to the associated paper, and, most prominently, four example tasks. These tasks were taken from the official ToT repository [31] as well as another ToT research project [12] as exemplary problem types for which ToT is particularly suited. When selected, the three corresponding prompts and the matching selection of settings for that task are automatically inserted into the relevant input windows and settings menu respectively, so the user can easily try them out. This serves as an introduction to the dashboard and settings usage and elucidates some suitable problems.

Real-time Thought Generation Status. One notable barrier to usability within our application is the latency of the API calls to the LLM. To alleviate the waiting time for thought generation, we include a real-time status update feature that displays the current stage of the thought generation. This is significantly more user-friendly than the unexplained long waiting time for each new layer, which may dissuade the user from continuing usage or indeed be perceived as a bug.

Tool Tips for Onboarding. Another feature addressing user feedback is the tooltips included in various parts of the application. By hovering over an info-icon, the user is presented with a concise explanation of its associated element. This feature is used throughout the interface, mostly to explain ToT-specific terminology, components, or settings.

Refer to caption
Figure 4:The first model response for the ”Mathematical Proof” case study. The option evaluated as the best by the model (highlighted in green) is wrong and the option chosen by the user (highlighted in yellow) is correct.
3Case Study
We demonstrate how iToT achieves the aims laid out in the previous sections in three case studies. The prompts referred to here can be found in Table 1 in the Supplemental Materials section.

Refer to caption
Figure 5:The user is not fully satisfied with the model’s conclusion and adds a thought expressing the step the user believes to be missing. In response, the model provides a more elaborate conclusion to the proof.
Case Study 1: Vacation Planning. In this case study the user is interested in using an LLM to plan out a three-day vacation in Barcelona. This presents an open-ended task that is highly dependent on user preference. Adapt the plan on the fly. Alongside the main prompt asking to plan the vacation the user provides a weekend trip they had in Frankfurt as the example prompt. In the first step the model provides a diverse array of options for activities on the first day and the user agrees with the option considered best by the model. On the second day, however, the user already has a different plan which is inserted as an additional thought. The model then adapts to the user’s interjection as shown in Figure 6 and tailors its options for the third day around the activities done on the second day. This case study shows the merits of tailoring the model’s output to the user’s preferences in an open-ended setting. The ability to choose amongst a set of options instead of getting a fixed answer empowers the user to explore ideas and consider what suits them best. Moreover, the option to add thoughts can act as a fine-grained approach to alter the model’s paths without needing to rerun the system from the beginning.

Refer to caption
Figure 6:The user adds constraints during the generation process and the model adapts to these
Case Study 2: Mathematical Proof. In this case study the user is a student working on a graph theory exercise sheet. The statement to be proven is that if a graph 
G
 is not connected then its complement 
G
¯
 is connected. Going by the definition that a graph is connected if any two vertices have a path between them the user first tried to prove the statement by looking at two vertices that do not have a path in 
G
 and showing that they do in 
G
¯
. This approach is, however, incorrect as it neglects to demonstrate that two vertices that are connected in 
G
 will still be connected in 
G
¯
. The user then prompts iToT with this problem and an example prompt that shows a step-by-step proof of the statement that the sum of degrees in a graph is even.

Identify the model’s wrong approach. The model provides two initial steps for the proof shown in Figure 4. The one evaluated by the system to be the best is exactly the one the user failed to prove the statement with. The user thus correctly identifies the second option as the better one. Here one can see the value of user guidance in allowing the user’s knowledge and experience to enhance the ToT process, even when the user does not know the correct solution.

Understand the answer. In the third step shown in Figure 5 the model completes the proof, but the user is not quite satisfied as to whether this truly demonstrates that two vertices that are connected in 
G
 will still be connected in 
G
¯
. The user thus adds the thought “It remains to show that two vertices within the same subgraph will still be connected”. The model then elaborates on this aspect giving a concrete proof of why such vertices would still be connected in 
G
¯
, thus completing the proof to the user’s satisfaction. This shows how adding thoughts can guide the model to provide better, more comprehensive answers and tailor its output to the user’s understanding. In this case it was used to check whether the model is capable of arriving at a more concrete and comprehensive proof.

Refer to caption
Figure 7:Evaluation prompt on top: ”Steps that use more of the graph should be valued more highly”. Bottom: ”Steps that take a global approach as opposed to a local one should be valued more highly”.
Case Study 3: Understanding the model. In this case study, an LLM researcher is interested in gaining insights into how the given evaluation prompt shapes the model’s decision making. Building upon the example from Case Study 2, the researcher explores which evaluation prompts better enables the model to identify the correct graph-related proofs. In this particular example, the error occurred because the model focused on individual vertices rather than the whole graph. As showcased in the upper half of Figure 7, the first attempt using casual wording is unsuccessful. When phrasing this as an issue of a global vs a local approach, the model picks the correct option. The researcher thus gains insight into the model’s understanding of the graph problem by observing the correctness of the evaluation with different prompts. Similarly, they can compare the effect of different settings, such as temperature, on correct generation and evaluation.

Conclusion. In the first two case studies we observe that our system is capable of novel tasks with little effort required from the user. This demonstrates that iToT acts as a general-purpose system. Secondly, these case studies show the need for user guidance during the generation process to profit from the user’s experience and to tailor the response to the user’s preferences. Lastly, the third case study shows how a researcher may use iToT to investigate how different evaluation prompts shape the model’s decision making and understanding of the problem at hand.

4Conclusion and Discussion
In this paper, we introduce iToT, an interactive open-domain interface designed for the custom thought generation of LLMs. To achieve more accurate, context-aware, and personalized responses, we have enhanced the interactivity at every stage of the Tree-of-Thought construction, from its parametrization to thought evaluation. By incorporating thought ranking and semantic grouping, users receive continuous feedback on the status of the ToT, allowing them to adjust their inputs accordingly. To aid user exploration, we have also included onboarding features like an initial guide and tooltips. Our novel contribution lies in integrating user inputs at every step of the thought generation process, which we plan to further explore to improve Tree-of-Thoughts functionality. iToT offers significant benefits to various user groups: lay users can generate higher-quality text solutions for diverse problems; machine learning engineers can refine their ToT prompting strategies; and LLM experts can delve into the strengths, weaknesses, implementation of ToT, and all accompanying usage details. As language models and chatbots become increasingly prevalent in daily tasks, iToT stands as a valuable asset in this evolving landscape.

Model Self-Consistency. Although ToT revolves around the exploration of diverse problem-solving paths, we use the semantic grouping feature to make users aware of the model’s self-consistency, which can conceal issues such as hallucination and bias. This is most applicable in constrained, logical task types. For instance, if the model is answering a factual question about a named entity and none of the branches are grouped, this indicates a high variance in the model’s output where it should be certain of one particular answer. The logical grouping method provides logical inference between the different answers, thus the user can use this grouping, or lack thereof, as a visual hint for clarity or contradiction within the suggested outputs.

Limitations and Recommended Usage. We notice that the quality of the output depends heavily on the presence and suitability of the two system prompts. We strongly recommend changing them depending on the task at hand. In case the default system prompts are used, we observe good results for more creative tasks but a worse performance for tasks with strict and clear constraints, such as the crossword puzzle. Within the iToT framework, we offer GPT-3.5 Turbo, GPT-4, and GPT-4o. Although GPT-3.5 Turbo API calls are considerably less expensive, we note a higher output quality - particularly in adherence to the desired output structure - when working with the newer models and thus suggest using the GPT-4 series for the best results.

Future Work. To expand the iToT framework, we propose:

• Automatic Tree Extension. Currently, each layer of the tree has to be generated through active user decisions and actions. The natural next step is to have an auto-solve mode, wherein the full path to the best final answer is generated automatically according to the model’s self-evaluation.
• Custom Output Parsing: Generated thoughts in iToT could follow a specific format, for example, using a regular expression so that the user can extract only the necessary solution from each generated thought. This would help in constrained problems such as the crossword puzzle.
• Token-Level Tree-of-Thoughts: Limiting for the number of tokens generated per thought for more fine-grained control.
• Explainability: iToT could offer more transparency to users to grasp which parts of the main prompt resulted in a particular word in one of the output thoughts.
References
[1]
Awesome llm web ui.https://github.com/JShollaj/Awesome-LLM-Web-UI.Accessed: 2024-07-07.
[2]
Llm visualization.https://bbycroft.net/llm.Accessed: 2024-07-07.
[3]
J. Achiam, S. Adler, S. Agarwal, L. Ahmad, I. Akkaya, F. L. Aleman, D. Almeida, J. Altenschmidt, S. Altman, S. Anadkat, et al.Gpt-4 technical report.arXiv preprint arXiv:2303.08774, 2023.
[4]
S. Arora, A. Narayan, M. F. Chen, L. Orr, N. Guha, K. Bhatia, I. Chami, and C. Re.Ask me anything: A simple strategy for prompting language models.In The Eleventh International Conference on Learning Representations, 2022.
[5]
M. Besta, N. Blach, A. Kubicek, R. Gerstenberger, M. Podstawski, L. Gianinazzi, J. Gajda, T. Lehmann, H. Niewiadomski, P. Nyczyk, et al.Graph of thoughts: Solving elaborate problems with large language models.In Proceedings of the AAAI Conference on Artificial Intelligence, vol. 38, pp. 17682–17690, 2024.
[6]
T. Brown, B. Mann, N. Ryder, M. Subbiah, J. D. Kaplan, P. Dhariwal, A. Neelakantan, P. Shyam, G. Sastry, A. Askell, et al.Language models are few-shot learners.Advances in neural information processing systems, 33:1877–1901, 2020.
[7]
Y. Cai, S. Mao, W. Wu, Z. Wang, Y. Liang, T. Ge, C. Wu, W. You, T. Song, Y. Xia, et al.Low-code llm: Graphical user interface over large language models.arXiv preprint arXiv:2304.08103, 2023.
[8]
B. Chen, Z. Zhang, N. Langrené, and S. Zhu.Unleashing the potential of prompt engineering in large language models: a comprehensive review.arXiv preprint arXiv:2310.14735, 2023.
[9]
F. Cheng, V. Zouhar, S. Arora, M. Sachan, H. Strobelt, and M. El-Assady.Relic: Investigating large language model responses using self-consistency.In Proceedings of the CHI Conference on Human Factors in Computing Systems, CHI ’24. Association for Computing Machinery, New York, NY, USA, 2024. doi: 10 . 1145/3613904 . 3641904
[10]
S. Frieder, L. Pinchetti, R.-R. Griffiths, T. Salvatori, T. Lukasiewicz, P. Petersen, and J. Berner.Mathematical capabilities of chatgpt.Advances in neural information processing systems, 36, 2024.
[11]
P. He, X. Liu, J. Gao, and W. Chen.Deberta: Decoding-enhanced bert with disentangled attention.In International Conference on Learning Representations, 2021.
[12]
D. Hulbert.Using Tree-of-Thought Prompting to boost ChatGPT’s reasoning, May 2023.
[13]
P. Jiang, J. Rayan, S. P. Dow, and H. Xia.Graphologue: Exploring large language model responses with interactive diagrams.In Proceedings of the 36th Annual ACM Symposium on User Interface Software and Technology, UIST ’23. Association for Computing Machinery, New York, NY, USA, 2023. doi: 10 . 1145/3586183 . 3606737
[14]
Z. Jiang, F. F. Xu, L. Gao, Z. Sun, Q. Liu, J. Dwivedi-Yu, Y. Yang, J. Callan, and G. Neubig.Active retrieval augmented generation.arXiv preprint arXiv:2305.06983, 2023.
[15]
J. Kaddour, J. Harris, M. Mozes, H. Bradley, R. Raileanu, and R. McHardy.Challenges and applications of large language models.arXiv preprint arXiv:2307.10169, 2023.
[16]
T. Kojima, S. S. Gu, M. Reid, Y. Matsuo, and Y. Iwasawa.Large language models are zero-shot reasoners.Advances in neural information processing systems, 35:22199–22213, 2022.
[17]
A. Lazaridou, E. Gribovskaya, W. Stokowiec, and N. Grigorev.Internet-augmented language models through few-shot prompting for open-domain question answering.arXiv preprint arXiv:2203.05115, 2022.
[18]
A. Madaan, N. Tandon, P. Gupta, S. Hallinan, L. Gao, S. Wiegreffe, U. Alon, N. Dziri, S. Prabhumoye, Y. Yang, et al.Self-refine: Iterative refinement with self-feedback.Advances in Neural Information Processing Systems, 36, 2024.
[19]
A. Madaan and A. Yazdanbakhsh.Text and patterns: For effective chain of thought, it takes two to tango.arXiv preprint arXiv:2209.07686, 2022.
[20]
OpenAI.Hello GPT-4o, May 2024.
[21]
V. Plevris, G. Papazafeiropoulos, and A. Jiménez Rios.Chatbots put to the test in math and logic problems: a comparison and assessment of chatgpt-3.5, chatgpt-4, and google bard.AI, 4(4):949–969, 2023.
[22]
A. Radford, J. Wu, R. Child, D. Luan, D. Amodei, I. Sutskever, et al.Language models are unsupervised multitask learners.OpenAI blog, 1(8):9, 2019.
[23]
N. Reimers and I. Gurevych.Sentence-bert: Sentence embeddings using siamese bert-networks.In Proceedings of the 2019 Conference on Empirical Methods in Natural Language Processing. Association for Computational Linguistics, 11 2019.
[24]
L. Salewski, S. Alaniz, I. Rio-Torto, E. Schulz, and Z. Akata.In-context impersonation reveals large language models’ strengths and biases.Advances in Neural Information Processing Systems, 36, 2024.
[25]
G. Team, R. Anil, S. Borgeaud, Y. Wu, J.-B. Alayrac, J. Yu, R. Soricut, J. Schalkwyk, A. M. Dai, A. Hauth, et al.Gemini: a family of highly capable multimodal models.arXiv preprint arXiv:2312.11805, 2023.
[26]
H. Touvron, T. Lavril, G. Izacard, X. Martinet, M.-A. Lachaux, T. Lacroix, B. Rozière, N. Goyal, E. Hambro, F. Azhar, et al.Llama: Open and efficient foundation language models.arXiv preprint arXiv:2302.13971, 2023.
[27]
X. Wang, J. Wei, D. Schuurmans, Q. Le, E. Chi, S. Narang, A. Chowdhery, and D. Zhou.Self-consistency improves chain of thought reasoning in language models.arXiv preprint arXiv:2203.11171, 2022.
[28]
J. Wei, X. Wang, D. Schuurmans, M. Bosma, F. Xia, E. Chi, Q. V. Le, D. Zhou, et al.Chain-of-thought prompting elicits reasoning in large language models.Advances in neural information processing systems, 35:24824–24837, 2022.
[29]
W. Wu, S. Mao, Y. Zhang, Y. Xia, L. Dong, L. Cui, and F. Wei.Visualization-of-thought elicits spatial reasoning in large language models.arXiv preprint arXiv:2404.03622, 2024.
[30]
Y. Xie, K. Kawaguchi, Y. Zhao, J. X. Zhao, M.-Y. Kan, J. He, and M. Xie.Self-evaluation guided beam search for reasoning.Advances in Neural Information Processing Systems, 36, 2024.
[31]
S. Yao.Tree of thought llm.https://github.com/princeton-nlp/tree-of-thought-llm/commits/master/, 2013.
[32]
S. Yao, D. Yu, J. Zhao, I. Shafran, T. Griffiths, Y. Cao, and K. Narasimhan.Tree of thoughts: Deliberate problem solving with large language models.Advances in Neural Information Processing Systems, 36, 2024.
[33]
A. Yuan, A. Coenen, E. Reif, and D. Ippolito.Wordcraft: Story writing with large language models.In Proceedings of the 27th International Conference on Intelligent User Interfaces, IUI ’22, p. 841–852. Association for Computing Machinery, New York, NY, USA, 2022. doi: 10 . 1145/3490099 . 3511105
[34]
D. Zhou, N. Schärli, L. Hou, J. Wei, N. Scales, X. Wang, D. Schuurmans, C. Cui, O. Bousquet, Q. Le, et al.Least-to-most prompting enables complex reasoning in large language models.arXiv preprint arXiv:2205.10625, 2022.
Supplemental Materials
iToT technical stack
iToT consists of a backend and a frontend, communicating with each other via HTTP requests. Specifically, our backend serves a RESTful API, allowing the frontend to perform the actions requested by the user. Our backend is written entirely in Python, using the FastAPI library3 to serve the previously mentioned API. We communicate with these models using a Microsoft Azure subscription and the relevant Python packages. We serve the backend using Uvicorn4. Our frontend is written in React5 and served via Vite6.

Case Study Prompts
Case
 	Prompts
Studies
 	
Main Prompt
Example Prompt
Evaluation Prompt
Vacation Planning
 	
I have a 3-day in Barcelona from 9-12 July. Help me plan how to get the most out of this trip.
Input: Help me plan a weekend in Frankfurt. Day 1: Visit the Dom/Römer area and enjoy a cozy walk in Oldtown. Make sure you walk across the main and if the weather is good even try stand-up paddling. Day 2: Try out the famous Apfelwein (Äppler) in the old Sachenhaus district. If you’re into shopping then visit the Zeil.
The quality of a thought is determined by its coherence with the thoughts in the chain before it and its contribution to solving the problem at hand.
Mathematical Proof (User)
 	
Prove that if a graph is not connected then its complement is connected.
Input: Show that the sum of all degrees of a graph is even. Step 1: Take the sum over all degrees. Step 2: Notice that this some counts every edge in the graph twice.Step 3: Thus, this sum is two times the number of edges in the graph. Step 4: Hence the sum of all degrees is even.
The quality of a thought is determined by its coherence with the thoughts in the chain before it and its contribution to solving the problem at hand.
Mathematical Proof (Researcher Unsuccessful)
 	
Prove that if a graph is not connected then its complement is connected.
Input: Show that the sum of all degrees of a graph is even. Step 1: Take the sum over all degrees. Step 2: Notice that this some counts every edge in the graph twice.Step 3: Thus, this sum is two times the number of edges in the graph. Step 4: Hence the sum of all degrees is even.
Steps that use more of the graph should be valued more highly.
Mathematical Proof (Researcher Successful)
 	
Prove that if a graph is not connected then its complement is connected.
Input: Show that the sum of all degrees of a graph is even. Step 1: Take the sum over all degrees. Step 2: Notice that this some counts every edge in the graph twice.Step 3: Thus, this sum is two times the number of edges in the graph. Step 4: Hence the sum of all degrees is even.
Steps that take a global approach as opposed to a local one should be valued more highly.
Table 1:The table shows the prompts used in the case studies.
