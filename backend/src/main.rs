use clap::Parser;

mod model {
    #[derive(Copy, Clone, PartialEq, Eq, Debug)]
    pub enum TaskStatus {
        Todo,
        Wip,
        Review,
    }

    impl std::fmt::Display for TaskStatus {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            let s = match self {
                Self::Todo => "todo",
                Self::Wip => "wip",
                Self::Review => "review",
            };
            s.fmt(f)
        }
    }
    impl std::str::FromStr for TaskStatus {
        type Err = String;

        fn from_str(s: &str) -> Result<Self, Self::Err> {
            match s {
                "todo" => Ok(Self::Todo),
                "wip" => Ok(Self::Wip),
                "review" => Ok(Self::Review),
                _ => Err(format!("Unknown status: {s}")),
            }
        }
    }
}

/// Turns a text-based knowledge base into a GTD system
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Task status todo, wip, or review
    #[arg(short, long)]
    status: model::TaskStatus,

    /// Number of times to greet
    #[arg(short, long, default_value_t = 1)]
    count: u8,
}

fn main() {
    let args = Args::parse();

    for _ in 0..args.count {
        println!("Hello {}!", args.status)
    }
}
