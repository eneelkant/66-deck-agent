# 66° Deck Agent usage log: one-time BigQuery setup

Done once by an admin (Neelkant Ekbote or Deepanjan Dasgupta) in the Google Cloud project `d-marketing-ai-applications`.
Pushing the code does not create anything in BigQuery.

1. **Create the dataset, tables and views.** Open BigQuery in the Cloud console, select the project, open a new query
   tab, paste the whole of `setup/usage_bigquery.sql` and run it. Location is `US`; change it in the first statement
   to `asia-south1` before running if the data must stay in India (it cannot be changed later).

2. **Create the writer role** (Cloud Shell):
   ```
   gcloud iam roles create deckUsageWriter --project=d-marketing-ai-applications \
     --title="Deck usage writer" --permissions=bigquery.tables.get,bigquery.tables.updateData
   ```

3. **Let everyone at 66degrees.com add rows to the log table only** (they cannot read, change or delete it):
   ```
   bq add-iam-policy-binding --member=domain:66degrees.com \
     --role=projects/d-marketing-ai-applications/roles/deckUsageWriter \
     d-marketing-ai-applications:deck_agent.deck_usage
   ```

4. **Give the two admins read access** (skip for anyone who is already a project Owner):
   ```
   gcloud projects add-iam-policy-binding d-marketing-ai-applications \
     --member=user:neelkant.ekbote@66degrees.com --role=roles/bigquery.jobUser
   gcloud projects add-iam-policy-binding d-marketing-ai-applications \
     --member=user:deepanjan.dasgupta@66degrees.com --role=roles/bigquery.jobUser
   ```
   Then in BigQuery: dataset `deck_agent` → Sharing → Permissions → Add principal → both emails →
   role **BigQuery Data Viewer**.

5. **Check who else can see BigQuery in the project.** IAM & Admin → IAM: users of the add-on should only have
   **Vertex AI User**. Anyone with Project Viewer / Editor or a BigQuery role at project level can see the dataset.

6. **Fill in the prices.** Run the `INSERT INTO ... model_rates` example at the end of section 3 of the SQL file with
   the current Vertex AI prices (USD per 1 million input / output tokens). When a price changes, add a new row with the
   date it starts; older runs keep their old price.

7. **Check it works.** Make one deck, then run:
   ```
   SELECT * FROM `d-marketing-ai-applications.deck_agent.v_runs` ORDER BY ts_ist DESC LIMIT 20;
   ```

Views: `v_usage_cost` (every row with its cost), `v_runs` (one row per run and model), `v_daily_user` (per day usage),
`v_summary_model`, `v_summary_user`, `v_summary_category` (by month).
