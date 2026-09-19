import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { listRecentEmails, readEmail, draftReply } from './emailTools';
import { listTodayEvents, createCalendarEvent } from './calendarTools';
import { listTasks, createTask, completeTask } from './taskTools';
import { getAccountBalances, getRecentTransactions } from './financeTools';

export type ToolHandler = (userId: string, args: any) => Promise<string>;

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'listRecentEmails',
    description:
      "Lists the user's most recent inbox emails (subject, sender, date, snippet) from whichever email " +
      'provider (Google or Yahoo) they currently have connected.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        maxResults: {
          type: SchemaType.NUMBER,
          description: 'How many recent emails to return. Defaults to 10.',
        },
      },
    },
  },
  {
    name: 'readEmail',
    description: 'Reads the full body of a single email by its message id, as returned by listRecentEmails.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        messageId: { type: SchemaType.STRING, description: 'The id of the email to read.' },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'draftReply',
    description: 'Saves a draft reply to an existing email for the user to review and send themselves.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        messageId: { type: SchemaType.STRING, description: 'The id of the email being replied to.' },
        body: { type: SchemaType.STRING, description: 'The plain-text body of the reply.' },
      },
      required: ['messageId', 'body'],
    },
  },
  {
    name: 'listTodayEvents',
    description: "Lists all of the user's Google Calendar events for today.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: 'createCalendarEvent',
    description: 'Creates a new event on the user\'s Google Calendar.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        summary: { type: SchemaType.STRING, description: 'The event title.' },
        startIso: { type: SchemaType.STRING, description: 'Start time as an ISO 8601 datetime.' },
        endIso: { type: SchemaType.STRING, description: 'End time as an ISO 8601 datetime.' },
        description: { type: SchemaType.STRING, description: 'Optional event description.' },
        attendees: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'Optional list of attendee email addresses.',
        },
      },
      required: ['summary', 'startIso', 'endIso'],
    },
  },
  {
    name: 'listTasks',
    description: "Lists the user's incomplete Google Tasks.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: 'createTask',
    description: 'Creates a new Google Task for the user.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: 'The task title.' },
        notes: { type: SchemaType.STRING, description: 'Optional additional notes.' },
        dueIso: { type: SchemaType.STRING, description: 'Optional due date as an ISO 8601 date.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'completeTask',
    description: 'Marks an existing Google Task as completed.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        taskId: { type: SchemaType.STRING, description: 'The id of the task to complete.' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'getAccountBalances',
    description: "Fetches the user's bank account balances via their connected Plaid account.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: 'getRecentTransactions',
    description: "Fetches the user's recent bank transactions via their connected Plaid account.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        days: { type: SchemaType.NUMBER, description: 'How many days back to look. Defaults to 7.' },
      },
    },
  },
];

export const toolHandlers: Record<string, ToolHandler> = {
  listRecentEmails: (userId, args) => listRecentEmails(userId, args ?? {}),
  readEmail: (userId, args) => readEmail(userId, args ?? {}),
  draftReply: (userId, args) => draftReply(userId, args ?? {}),
  listTodayEvents: (userId) => listTodayEvents(userId),
  createCalendarEvent: (userId, args) => createCalendarEvent(userId, args ?? {}),
  listTasks: (userId) => listTasks(userId),
  createTask: (userId, args) => createTask(userId, args ?? {}),
  completeTask: (userId, args) => completeTask(userId, args ?? {}),
  getAccountBalances: (userId) => getAccountBalances(userId),
  getRecentTransactions: (userId, args) => getRecentTransactions(userId, args ?? {}),
};
