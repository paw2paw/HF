# ARC-002 — Logical System Architecture (Conversation Quality Improvement)

## Status
Proposed

## Purpose
Define the logical components of HF and how they interact to:
- run adaptive conversations in real time
- evaluate conversation quality after completion
- improve future conversations via baseline updates

This architecture explicitly separates:
- **runtime conversation path**
- **offline evaluation and learning path**

---

## High-level architecture (logical)

```mermaid
flowchart TB

%% ========================
%% Runtime Conversation Path
%% ========================

User -->|voice| SessionManager
SessionManager --> PromptComposer
PromptComposer -->|baseline prompt| VoiceAdapter
VoiceAdapter -->|responses| SessionManager

SessionManager -->|events, turns| SessionStore

InjectionScheduler -->|time trigger| PromptComposer
PromptComposer -->|injected prompt| VoiceAdapter
SessionManager -->|InjectionEvent| SessionStore

%% ========================
%% Offline Evaluation Path
%% ========================

SessionStore -->|completed session| EvaluationAgent
EvaluationAgent --> EvaluationResultStore
EvaluationAgent -->|memory updates| MemoryStore

EvaluationResultStore --> ImprovementAgent
MemoryStore --> ImprovementAgent

ImprovementAgent -->|new parameters| BaselineGenerator
BaselineGenerator --> BaselineStore

BaselineStore -->|next baseline| PromptComposer
MemoryStore -->|retrieval| PromptComposer