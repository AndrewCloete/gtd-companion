use colored::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;

use regex::Regex;
#[derive(Copy, Serialize, Deserialize, Clone, PartialEq, Eq, Debug, Hash)]
pub enum TaskStatus {
    NoStatus,
    Todo,
    Wip,
    Review,
}

impl TaskStatus {
    fn re_status() -> Regex {
        Regex::new(r"(@todo|@wip|@review)").unwrap()
    }
    pub fn remove_status_str(task: &str) -> String {
        let no_status = TaskStatus::re_status().replace_all(task, "").to_string();
        Regex::new(r"\s+")
            .unwrap()
            .replace_all(&no_status, " ")
            .to_string()
    }
    pub fn classify(task: &str) -> TaskStatus {
        let status_str: Option<&str> = TaskStatus::re_status()
            .captures(task)
            .map(|cap| cap.get(0).unwrap().as_str());

        status_str
            .map(|s| TaskStatus::from_str(s).unwrap())
            .unwrap_or(TaskStatus::NoStatus)
    }
    pub fn all() -> Vec<TaskStatus> {
        return vec![
            TaskStatus::Wip,
            TaskStatus::Review,
            TaskStatus::Todo,
            TaskStatus::NoStatus,
        ];
    }

    pub fn to_color_str(&self) -> ColoredString {
        match self {
            TaskStatus::NoStatus => self.to_string().black(),
            TaskStatus::Todo => self.to_string().green(),
            TaskStatus::Wip => self.to_string().red(),
            TaskStatus::Review => self.to_string().yellow(),
        }
    }
}

impl std::fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Self::Todo => "@todo",
            Self::Wip => "@wip",
            Self::Review => "@review",
            Self::NoStatus => "@noStatus",
        };
        s.fmt(f)
    }
}
impl std::str::FromStr for TaskStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "@todo" => Ok(Self::Todo),
            "@wip" => Ok(Self::Wip),
            "@review" => Ok(Self::Review),
            "@noStatus" => Ok(Self::NoStatus),
            _ => Err(format!("Unknown status: {s}")),
        }
    }
}

#[derive(Serialize)]
struct TaskContext(String);

impl TaskContext {
    fn re_context() -> Regex {
        Regex::new(r"(#x[A-Za-z0-9]{1,})+").unwrap()
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
}
impl Task {
    pub fn re_any() -> Regex {
        Regex::new(r"(#x[A-Za-z0-9]{1,})|(#[d,s][0-9]{8})|@todo|@wip|@review").unwrap()
    }

    pub fn re_date() -> Regex {
        Regex::new(r"(#[d,s][0-9]{8})").unwrap()
    }

    pub fn extract_dates(task: &str) -> Option<TaskDates> {
        let dates: Vec<String> = TaskContext::re_context()
            .captures_iter(task)
            .map(|c| c.get(0).unwrap().as_str().into())
            .collect();
        let start: Option<String> = dates.iter().find(|s| s.contains('s')).cloned();
        let due: Option<String> = dates.iter().find(|s| s.contains('d')).cloned();

        if start.is_none() && due.is_none() {
            None
        } else {
            Some(TaskDates { start, due })
        }
    }

    pub fn remove_date(task: &str) -> String {
        let no_dates = Task::re_date().replace_all(task, "").to_string();
        Regex::new(r"\s+")
            .unwrap()
            .replace_all(&no_dates, " ")
            .to_string()
    }

    pub fn from(task: &str, project: &str) -> Task {
        let status = TaskStatus::classify(task);
        let contexts = TaskContext::extract_contexts(task);
        let dates = Task::extract_dates(task);
        let description = Task::remove_date(&TaskContext::remove_context_string(
            &TaskStatus::remove_status_str(&task),
        ));

        Task {
            project: String::from(project),
            description,
            status,
            contexts,
            dates,
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
