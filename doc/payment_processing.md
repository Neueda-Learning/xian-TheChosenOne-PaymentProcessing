# Payments Processing System Training Project

[TOC]

## Overview

Your team is challenged with designing a payment processing application that handles the complete lifecycle of financial payments.

The system will manage payments from creation through validation, processing, and completion (or failure), maintaining a full audit trail of status changes.

Your task is to build the application.

## Technical Goals

You should aim to create a Payments Processing REST API. This will be the main target for the training week where you learn about APIs.

This API should allow creating, retrieving, and tracking payments through their complete lifecycle.

If/When you have made progress on the core requirements then requirements for further enhancements will be provided. This will include open-ended enhancements whereby you can make use of your particular skills and experience.

We will continue working on this project into the week where you start looking at Web front ends.

For the Front end, you can use the technologies you have learned about in your training. If you wish to use a specific framework or some other technology, please check with your instructor.

The Front end should facilitate your users to (in order of priority):

* Create a new payment
* View payment status and details
* View payment history (all status transitions)
* Search/filter payments by status
* View error details for failed payments

In terms of detailed requirements, your instructor will act as customer, and will tell you what they want. You can arrange meetings with them as required.

## Payment Lifecycle

Your system should implement the following payment workflow:

```
CREATED → VALIDATED → SENT → COMPLETED
                  ↓
              FAILED (can occur at any stage)
```

**Status Definitions:**

* **CREATED** - Payment has been submitted but not yet validated
* **VALIDATED** - Payment has passed all validation rules and is ready to be sent
* **SENT** - Payment has been transmitted to the destination system
* **COMPLETED** - Payment has been successfully processed and confirmed
* **FAILED** - Payment has failed at some point in the process (with error code)

## Core Requirements

### API Endpoints

Design the REST API surface yourselves - decide what operations, routes, and HTTP methods make sense for creating, retrieving, and tracking a payment through its lifecycle. Use the REST API technology taught in your class (e.g., Spring Boot, Flask, Express.js, etc.).

## Notes

1. There will be no authentication and a single user is assumed, i.e. there is no requirement to manage users or account ownership.

2. You should use the database technology you have been using in the training for any persistent storage.

3. Make good use of git. Use branching and pull requests if you can.

4. Any documentation about how to use your REST API would be useful. Maybe Swagger/OpenAPI if you have covered it in your training.

5. For this training project, you do NOT need to integrate with real payment networks or gateways - simulate the processing internally.

## Technical Getting Started Checklist

1. Create your project structure.

2. Create a Git repository. Your instructors will guide you as to which Git platform to use.

3. Add, commit, push your skeleton project to your Git repository.

4. Ensure your team has access to the Git repository.

5. Decide on the absolute MINIMUM fields for a first working system e.g. the first version of your payment object may just be an id, amount, currency, and status.

If you get stuck getting any of the above completed then contact your instructor for help.

## Project Management Getting Started Checklist

1. As a team decide how you will approach the work. E.g. 2 people on the backend, 1 person on UI Design Vs. Everyone on the backend until a basic system is working.

2. Make a task list. Ideally use a tool such as Trello to keep track of tasks.

3. Some of your team may work on the DESIGN of a more fully-featured application, while some of your team work on BUILDING some small pieces as demonstration.

4. Choose the tasks required for a MINIMAL implementation first.

5. Your instructor will drop in regularly to see how you're progressing. Make a note of any questions so that you're ready to ask them then.

6. Your team should get together and decide on an initial set of data that you will store. A good team decision on this is a good path to success, however remember to STAY AGILE.
The single biggest problem teams face is starting out with a data model that is too complex.

## Suggestions for Success

1. START SMALL. Get a system working that stores a very simple payment with minimal fields. You can then enhance to store more complex payment data.

2. Try pair programming, it can be very effective.

3. Take conscious steps to keep a good energy in the team. E.g. give your team a name, systematically plan check-ins with each other.

4. Emphasise quality over quantity.

5. Think about idempotency early - what happens if someone submits the same payment twice?

6. Consider how you'll handle status transitions - can a payment go from COMPLETED back to CREATED? (Probably not!)



## Considerations

### Idempotency
* What happens if a client submits the same payment twice?
* Should duplicate payment requests be rejected or should they return the existing payment?
* How do you detect duplicates? (Consider using a client-provided idempotency key)

### Retry Handling
* Network calls can fail - how do you handle retries?
* Should status updates be retryable?
* How many times should you retry before marking something as FAILED?

### Status Transitions
* Define valid state transitions (e.g., COMPLETED → SENT is not valid)
* Implement validation to prevent invalid transitions
* Consider using a state machine pattern

### API Design Under Failure
* How do you communicate errors to clients?
* What HTTP status codes are appropriate for different error types?
* Should you return error codes that clients can use programmatically?

### Audit Trail
* Every status change should be recorded with a timestamp
* Who/what triggered the status change?
* This is crucial for debugging and compliance

## Project Presentations

At the end of the program you will get the opportunity to present your project to your instructors and also potentially your manager and other interested stakeholders from within the firm.

The duration of your presentation will be decided by your instructor, but they are typically 15-20 mins for groups of 3 and sometimes up to 25 or even 30 minutes for larger groups.

### Presentation Guidelines

Here is a suggested flow. You don't have to follow this exactly, but it gives you a suggested outline:

- Tell a story!
    - Your presentation should have a beginning, a middle and an end
- Start by introducing your team
- Then introduce the project
    - What have you been learning?
    - What were you asked to do?
    - How much time have you had to work on it?
- Then explain how you approached the project
    - Did you divide roles, e.g. backend or frontend?
    - Or did you code together, e.g. pair-programming?
    - What technologies and tools did you use?
- Then show what you built
    - Start with an overview of your data model – explain your decisions
    - Then show a high-level architecture of your application
      - This could be a simple diagram in PowerPoint
    - Then demonstrate the payment lifecycle with a live demo
    - Show the status history tracking
- Then tell us what challenges you faced
    - Did you work well together as a team?
    - Were there any technical challenges?
    - What mistakes did you make?
    - What would you do differently?
    - How did you handle edge cases (duplicates, failures, invalid transitions)?
- Then tell us what you would do next if you had more time
- And finally – thank you for listening, any questions

- Everyone is expected to speak
- Keep your cameras on throughout the presentation
- NOTE: YOU WILL BE EXPECTED TO ASK OTHER TEAMS QUESTIONS

### Presentation Mechanics

* Depending upon the size of your class, the presentations will be delivered with your groups nominated lead instructor
* The lead instructor will typically have created a schedule for the presentations and will have circulated that in advance with 15-30 mins per group
* The presentation will NOT be allowed to overrun to ensure we keep to time
* The presentation schedule is sent out to wider firm staff so they know when to come if someone wants to see your presentation
* When a group says "any questions?", to avoid any unnecessary silences, the group that went before you MUST ask a question. If you are going first, then the group scheduled last must ask a question
* If your class is using virtual machines then they will continue to be available for the presentation

## Appendix A: Notes on Teamwork

It is expected that you work closely as a team during this project.

Your team should be self-organising, but should raise issues with instructors if they are potential blockers to progress.

Your team can use a task management system such as Trello to keep track of tasks and progress. Divide the work appropriately.

Your team should keep track of all source code with git.

You may choose to create a separate repository for each component that you tackle e.g. front-end code can be in its own repository. If you create more than one back end application, then each can have its own repository. To keep track of your repositories, you can use a single 'Project' that each of your repositories is part of.

Your instructor and team members need to access all repositories, so they should be either:

a) Made public
b) Shared with your instructor and all team members.

Throughout your work, you should ensure good communication and organise regular check-ins with each other.

## Appendix B: Example Error Codes

Your system should define clear error codes for different failure scenarios:

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| VALIDATION_FAILED | Payment failed validation checks | 400 |
| INSUFFICIENT_FUNDS | Source account has insufficient funds | 400 |
| INVALID_ACCOUNT | Account number is invalid or doesn't exist | 400 |
| INVALID_CURRENCY | Currency code is not supported | 400 |
| INVALID_AMOUNT | Amount is zero, negative, or invalid | 400 |
| DUPLICATE_PAYMENT | Payment with same idempotency key exists | 409 |
| INVALID_STATUS_TRANSITION | Cannot transition from current status to requested status | 400 |
| PAYMENT_NOT_FOUND | Payment ID does not exist | 404 |
| PROCESSING_ERROR | Internal error during payment processing | 500 |
| NETWORK_ERROR | Communication failure with payment network | 503 |

## Appendix C: Validation Rules Examples

Consider implementing validation rules such as:

1. **Amount Validation**
   - Amount must be greater than 0
   - Amount must not exceed a maximum limit (e.g., 1,000,000)
   - Amount must have maximum 2 decimal places for most currencies

2. **Account Validation**
   - Source and destination accounts must be different
   - Account numbers must be valid format
   - Accounts must exist in the system

3. **Currency Validation**
   - Currency code must be valid ISO 4217 (e.g., USD, EUR, GBP)
   - System must support the specified currency

4. **Status Transition Validation**
   - Valid transitions:
     - CREATED → VALIDATED
     - CREATED → FAILED
     - VALIDATED → SENT
     - VALIDATED → FAILED
     - SENT → COMPLETED
     - SENT → FAILED
   - Invalid transitions should be rejected with clear error messages

## Appendix D: UI Ideas

Below are some UI concepts that might give you ideas. You are DEFINITELY NOT expected to implement these exactly as shown. This is JUST FOR DEMONSTRATION of the type of thing that COULD be shown.

### Create Payment Screen
* Form with fields:
  - Source Account (dropdown or text input)
  - Destination Account (text input)
  - Amount (numeric input)
  - Currency (dropdown: USD, EUR, GBP, etc.)
  - Reference/Description (optional text)
* Submit button
* Clear validation error messages

### Payment Details Screen
* Display payment information:
  - Payment ID
  - Status (with color coding: green for COMPLETED, yellow for in-progress, red for FAILED)
  - Amount and currency
  - Account details
  - Timestamps
* Status history timeline showing all transitions
* If failed, display error code and description

### Payment List Screen
* Table or list of payments
* Columns: Payment ID, Amount, Currency, Status, Created Date
* Filter by status (dropdown or tabs)
* Search by payment ID or reference
* Click row to view details

### Status History Visualization
* Timeline view showing:
  - Each status with timestamp
  - How long payment spent in each status
  - Any notes or error messages
  - Visual indicators for status transitions

## Appendix E: Advanced Features (If You Have Time)

Once you have the core system working, consider these enhancements:

1. **Batch Payments**
   - Submit multiple payments at once
   - Track batch status
   - Generate batch summary reports

2. **Payment Scheduling**
   - Schedule payments for future execution
   - Recurring payments

3. **Notifications**
   - Email or webhook notifications on status changes
   - Alert on failures

4. **Reporting/Analytics**
   - Daily transaction volumes
   - Success/failure rates
   - Average processing time per payment
   - Charts and graphs

5. **Concurrency Handling**
   - What happens if two users try to update the same payment simultaneously?
   - Implement optimistic locking or pessimistic locking

6. **Payment Reversal/Cancellation**
   - Cancel a payment before it's COMPLETED
   - Reverse a completed payment (creating a new offsetting payment)

7. **Multi-Currency Support**
   - Exchange rate lookup
   - Currency conversion

8. **Audit Logs**
   - Track who performed each action
   - Keep detailed logs for compliance

## Appendix F: Testing Considerations

Consider these testing scenarios:

1. **Happy Path**
   - Create a payment and watch it progress through all statuses to COMPLETED

2. **Validation Failures**
   - Try to create payment with negative amount
   - Try to create payment with invalid currency
   - Try to create payment with same source and destination account

3. **Duplicate Detection**
   - Submit the same payment twice with same idempotency key
   - Verify second request returns the existing payment

4. **Invalid State Transitions**
   - Try to move a COMPLETED payment back to CREATED
   - Verify appropriate error response

5. **Concurrent Updates**
   - Two requests trying to update the same payment simultaneously
   - Verify data consistency

6. **Database Failure Simulation**
   - What happens if database becomes unavailable during processing?
   - Should status update be rolled back?

## Appendix G: Architecture Suggestions

Consider a layered architecture:

```
┌─────────────────────────────────────┐
│         Web UI (Frontend)            │
│   (React, Vue, Angular, or similar)  │
└──────────────┬──────────────────────┘
               │ HTTP/REST
┌──────────────▼──────────────────────┐
│         REST API Layer               │
│    (Spring Boot / Flask / Express)   │
├──────────────────────────────────────┤
│         Business Logic Layer         │
│   - Payment validation               │
│   - Status transition logic          │
│   - Idempotency checking             │
├──────────────────────────────────────┤
│         Data Access Layer            │
│   - Repository pattern               │
│   - Transaction management           │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Database                     │
│   (PostgreSQL / MySQL / MongoDB)     │
└──────────────────────────────────────┘
```

**Key Considerations:**
* Separate concerns into distinct layers
* Make business logic testable independent of database
* Consider using the Repository pattern for data access
* Use dependency injection to make components loosely coupled
* Implement proper transaction management for database operations
