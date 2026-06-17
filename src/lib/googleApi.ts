import { getAccessToken } from './firebase';

// Google Sheets API Helpers
export async function createSpreadsheet(title: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Google access token not available.");

  const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      properties: { title }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to create spreadsheet.");
  }

  const data = await response.json();
  return data.spreadsheetId;
}

export async function addSpreadsheetRow(spreadsheetId: string, sheetTitle: string, rowValues: any[]): Promise<any> {
  const token = await getAccessToken();
  if (!token) return null;

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}!A:A:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        values: [rowValues]
      })
    }
  );

  if (!response.ok) {
    console.error("Failed to append row to Google Sheets", await response.text());
    return null;
  }
  return response.json();
}

// Ensure the spreadsheet is formatted with headings if newly created
export async function setupCollectionSheet(spreadsheetId: string, sheetTitle: string, headers: string[]): Promise<void> {
  const token = await getAccessToken();
  if (!token) return;

  // Add sheet table if not exists or insert header values
  // We can write to sheetTitle!A1:Z1
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}!A1?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        range: `${sheetTitle}!A1`,
        majorDimension: "ROWS",
        values: [headers]
      })
    }
  );
}

// Gmail API Helper
export async function sendGmailEmail(to: string, subject: string, bodyText: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;

  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const emailLines = [
    `To: ${to}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${utf8Subject}`,
    "",
    bodyText
  ];

  const emailRaw = btoa(unescape(encodeURIComponent(emailLines.join("\r\n"))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch("https://gmail.googleapis.com/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      raw: emailRaw
    })
  });

  return response.ok;
}

// Google Drive API Helper
export async function uploadReceiptToDrive(fileName: string, receiptContent: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const metadata = {
    name: fileName,
    mimeType: "text/plain"
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([receiptContent], { type: "text/plain" }));

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`
    },
    body: form
  });

  if (!response.ok) {
    console.error("Failed to upload file to Google Drive", await response.text());
    return null;
  }

  const data = await response.json();
  return data.id;
}

// Google Calendar API Helper
export async function createCalendarEvent(summary: string, description: string, startTimeIso: string, endTimeIso: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: startTimeIso },
      end: { dateTime: endTimeIso }
    })
  });

  if (!response.ok) {
    console.error("Failed to create Google Calendar Event", await response.text());
    return null;
  }

  const data = await response.json();
  return data.id;
}

// Google Tasks API Helper
export async function createGoogleTask(title: string, notes: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;

  // Get default tasklist list
  const listResponse = await fetch("https://tasks.googleapis.com/v1/users/@me/lists", {
    headers: { "Authorization": `Bearer ${token}` }
  });

  if (!listResponse.ok) return false;
  const listData = await listResponse.json();
  const defaultListId = listData.items?.[0]?.id;

  if (!defaultListId) return false;

  const response = await fetch(`https://tasks.googleapis.com/v1/lists/${defaultListId}/tasks`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title,
      notes,
      status: "needsAction"
    })
  });

  return response.ok;
}

// Google Contacts / People API Helper
export async function fetchGoogleContacts(): Promise<any[]> {
  const token = await getAccessToken();
  if (!token) return [];

  const response = await fetch("https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers", {
    headers: { "Authorization": `Bearer ${token}` }
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.connections || [];
}
