const steps = [
  {
    number: '01',
    title: 'Search',
    desc: 'Search for any product or store in Kejetia Market. Browse by category or keyword.',
    color: 'var(--red)',
  },
  {
    number: '02',
    title: 'Compare',
    desc: 'See prices, store details, and location. Pick the store that suits you best.',
    color: 'var(--gold)',
    textDark: true,
  },
  {
    number: '03',
    title: 'Visit & Buy',
    desc: 'Get directions on the map, call the store owner, and head there to buy.',
    color: 'var(--green)',
  },
]

export default function HowItWorks() {
  return (
    <section style={styles.section}>
      <div className="container">
        <div style={styles.header}>
          <h2 style={styles.title}>How It Works</h2>
          <p style={styles.desc}>Three simple steps to find what you need</p>
        </div>

        <div style={styles.grid}>
          {steps.map((step, i) => (
            <div key={i} style={styles.card}>
              <div style={{ ...styles.number, background: step.color, color: step.textDark ? 'var(--black)' : 'var(--white)' }}>
                {step.number}
              </div>
              <h3 style={styles.stepTitle}>{step.title}</h3>
              <p style={styles.stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const styles = {
  section: {
    padding: '80px 0',
    background: 'var(--off-white)',
  },
  header: {
    textAlign: 'center',
    marginBottom: 56,
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    color: 'var(--black)',
    marginBottom: 8,
  },
  desc: {
    fontSize: 16,
    color: 'var(--gray-600)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 32,
    maxWidth: 960,
    margin: '0 auto',
  },
  card: {
    textAlign: 'center',
    padding: '0 16px',
  },
  number: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    margin: '0 auto 24px',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--gray-800)',
    marginBottom: 12,
  },
  stepDesc: {
    fontSize: 15,
    color: 'var(--gray-600)',
    lineHeight: 1.7,
  },
}
