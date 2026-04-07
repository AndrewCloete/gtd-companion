use colored::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env::var;
use std::fs;
use std::str::FromStr;

#[derive(Debug, Deserialize, Clone)]
pub struct ServerConfig {
    pub host: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ConfigFile {
    pub default_dirs: Option<Vec<std::path::PathBuf>>,
    pub inbox_path: Option<String>,
    pub ignore_files: Option<Vec<String>>,
    pub default_not_context: Option<Vec<String>>,
    /// Explicit list of status keys (without `@`) that the parser should recognise,
    /// e.g. `["todo", "wip", "review"]`.  Only tokens in this list are treated as
    /// status tags; everything else is left in the task description.
    pub statuses: Option<Vec<String>>,
    pub server: Option<ServerConfig>,
}

impl ConfigFile {
    fn new() -> ConfigFile {
        return ConfigFile {
            default_dirs: None,
            inbox_path: None,
            ignore_files: None,
            default_not_context: None,
            statuses: None,
            server: None,
        };
    }

    pub fn read() -> ConfigFile {
        let default_config_name = ".gtd.toml";
        let home_path = var("HOME").expect("$HOME not defined");
        match fs::read_to_string(format!("{}/{}", home_path, default_config_name)) {
            Err(_) => ConfigFile::new(),
            Ok(content) => toml::from_str(&content).expect("Config was not well formatted"),
        }
    }
}

use regex::Regex;

/// A task status derived from an `@word` token in a markdown bullet.
/// `NoStatus` means no status token was present (or `@noStatus` was explicit).
/// `Status(key)` holds the word after `@` exactly as written, e.g. `"todo"`, `"wip"`, or any
/// custom label like `"waiting"`.
#[derive(Clone, PartialEq, Eq, Debug, Hash)]
pub enum TaskStatus {
    NoStatus,
    Status(String),
}

impl serde::Serialize for TaskStatus {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        match self {
            TaskStatus::NoStatus => s.serialize_str("NoStatus"),
            TaskStatus::Status(key) => s.serialize_str(key),
        }
    }
}

impl<'de> serde::Deserialize<'de> for TaskStatus {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let raw = String::deserialize(d)?;
        Ok(TaskStatus::from_str(&raw).unwrap_or(TaskStatus::Status(raw)))
    }
}

impl TaskStatus {
    /// Builds a regex that matches only the status tokens declared in `statuses`
    /// plus the special `@noStatus` sentinel.
    /// Keys are stored without the leading `@`; they are expected to be
    /// simple alphanumeric words (no escaping needed).
    fn re_status(statuses: &[String]) -> Option<Regex> {
        let mut keys = statuses.to_vec();
        if !keys.contains(&"noStatus".to_string()) {
            keys.push("noStatus".to_string());
        }
        // If the caller provided no statuses, the only thing we can match is
        // the explicit `@noStatus` reset token — still useful.
        let pattern = keys
            .iter()
            .map(|k| format!("@({})", k))
            .collect::<Vec<_>>()
            .join("|");
        Regex::new(&pattern).ok()
    }

    pub fn remove_status_str(task: &str, statuses: &[String]) -> String {
        let Some(re) = TaskStatus::re_status(statuses) else {
            return task.to_string();
        };
        let no_status = re.replace_all(task, "").to_string();
        Regex::new(r"\s+")
            .unwrap()
            .replace_all(&no_status, " ")
            .to_string()
    }

    pub fn classify(task: &str, statuses: &[String]) -> TaskStatus {
        let Some(re) = TaskStatus::re_status(statuses) else {
            return TaskStatus::NoStatus;
        };
        re.captures(task)
            .and_then(|cap| cap.get(0))
            .map(|m| {
                // The full match is the token, e.g. `@todo`
                let token = m.as_str();
                TaskStatus::from_str(token).unwrap_or(TaskStatus::NoStatus)
            })
            .unwrap_or(TaskStatus::NoStatus)
    }

    pub fn to_color_str(&self) -> ColoredString {
        match self {
            TaskStatus::NoStatus => self.to_string().black(),
            TaskStatus::Status(key) => match key.as_str() {
                "todo" => self.to_string().green(),
                "review" => self.to_string().yellow(),
                _ => self.to_string().red(),
            },
        }
    }
}

impl std::fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NoStatus => write!(f, "@noStatus"),
            Self::Status(key) => write!(f, "@{}", key),
        }
    }
}

impl std::str::FromStr for TaskStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if s == "@noStatus" || s == "NoStatus" {
            Ok(Self::NoStatus)
        } else if let Some(key) = s.strip_prefix('@') {
            Ok(Self::Status(key.to_string()))
        } else {
            Err(format!("Not a status token: {s}"))
        }
    }
}

#[derive(Serialize)]
struct TaskContext(String);

impl TaskContext {
    fn re_context() -> Regex {
        Regex::new(r"(#x[A-Za-z0-9_]{1,})+").unwrap()
    }

    pub fn extract_contexts(task: &str) -> Vec<String> {
        TaskContext::re_context()
            .captures_iter(task)
            .map(|c| c.get(0).unwrap().as_str().into())
            .collect()
    }

    pub fn remove_context_string(task: &str) -> String {
        let no_contexts = TaskContext::re_context().replace_all(task, "").to_string();
        Regex::new(r"\s+")
            .unwrap()
            .replace_all(&no_contexts, " ")
            .to_string()
    }
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Debug, Hash)]
pub struct TaskDates {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub start: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub due: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub visible: Option<String>,
}

impl TaskDates {
    pub fn re_date() -> Regex {
        Regex::new(r"(@[d,s,b,v][0-9]{8})").unwrap()
    }

    fn parse_date(dates: &Vec<String>, c: char) -> Option<String> {
        dates
            .iter()
            .find(|s| s.contains(c))
            .cloned()
            .map(|s| s.replace(&format!("@{}", c), ""))
    }

    pub fn extract_dates(task: &str) -> Option<TaskDates> {
        let dates: Vec<String> = TaskDates::re_date()
            .captures_iter(task)
            .map(|c| c.get(0).unwrap().as_str().into())
            .collect();
        let start: Option<String> = TaskDates::parse_date(&dates, 's');
        let both: Option<String> = TaskDates::parse_date(&dates, 'b');
        let due: Option<String> = both.clone().or(TaskDates::parse_date(&dates, 'd'));
        let visible: Option<String> = both.clone().or(TaskDates::parse_date(&dates, 'v'));

        if start.is_none() && due.is_none() && visible.is_none() {
            None
        } else {
            Some(TaskDates {
                start,
                due,
                visible,
            })
        }
    }

    pub fn remove_date(task: &str) -> String {
        let no_dates = TaskDates::re_date().replace_all(task, "").to_string();
        Regex::new(r"\s+")
            .unwrap()
            .replace_all(&no_dates, " ")
            .to_string()
    }
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Debug, Hash)]
pub struct Task {
    pub description: String,
    pub project: String,
    pub status: TaskStatus,
    pub contexts: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub dates: Option<TaskDates>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub line: Option<u32>,
}
impl Task {
    /// Builds a regex that matches any line worth parsing as a task: a context
    /// token (`#x…`), a date token (`@d20260407` style), or one of the declared
    /// status keys.
    pub fn re_any(statuses: &[String]) -> Regex {
        let mut parts = vec![
            r"#x[A-Za-z0-9]{1,}".to_string(),
            r"@[d,s,b,v][0-9]{8}".to_string(),
        ];
        for key in statuses {
            parts.push(format!("@{}", key));
        }
        Regex::new(&parts.join("|")).unwrap()
    }

    pub fn from(
        task: &str,
        project: &str,
        file_path: Option<String>,
        line: Option<u32>,
        statuses: &[String],
    ) -> Task {
        let status = TaskStatus::classify(task, statuses);
        let contexts = TaskContext::extract_contexts(task);
        let dates = TaskDates::extract_dates(task);
        let description = TaskDates::remove_date(&TaskContext::remove_context_string(
            &TaskStatus::remove_status_str(task, statuses),
        ));

        Task {
            project: String::from(project),
            description,
            status,
            contexts,
            dates,
            file_path,
            line,
        }
    }

    pub fn has_noflags(&self) -> bool {
        self.contexts.is_empty() && self.status == TaskStatus::NoStatus && self.dates.is_none()
    }

    pub fn ctx_line(&self) -> String {
        let with_project = format!("{} {}", self.project.bold(), self.description);

        Regex::new(r"\s+")
            .unwrap()
            .replace_all(&with_project, " ")
            .to_string()
    }
}

impl std::fmt::Display for Task {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let context_with_color = self
            .contexts
            .iter()
            .fold(self.description.clone(), |desc: String, c: &String| {
                format!("{} {}", desc, c.blue())
            });

        Regex::new(r"\s+")
            .unwrap()
            .replace_all(&context_with_color, " ")
            .to_string()
            .fmt(f)
    }
}

#[derive(Debug, Serialize)]
pub struct Project {
    pub file_name: String,
    pub tasks: HashMap<TaskStatus, Vec<Task>>,
}
